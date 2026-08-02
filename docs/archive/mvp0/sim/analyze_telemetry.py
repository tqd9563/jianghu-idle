#!/usr/bin/env python3
"""MVP-0 派生指标离线计算 —— 消费观察员面板导出的测试数据 JSON。

权威口径：../telemetry.md v1.1 §2（逐节对齐，节号见各函数 docstring）。
用法：
    python3 analyze_telemetry.py mvp0_T01_20260706.json [mvp0_T02_*.json ...]
每个文件 = 一名测试者的完整会话导出（meta + events）。python3 无第三方依赖。

与 mvp0_sim.py 同仓：模拟器给出理论基线（如二轮提速 28%、最大间隔 4.4 分钟），
本脚本给出真人实测值，两边共用同一套里程碑与净时间定义，便于对照。
"""
import json
import sys

# ---- 目标区间（规格书 §8.5 / §10.1 / §6.1；判定档位见测试方案 §2） ----
SPEEDUP_TARGETS = {          # 里程碑: (下限, 上限)；None = 不设上限
    "realm2": (0.30, 0.50),
    "boss1_kill": (0.25, 0.40),
    "boss2_arrive": (0.25, 0.40),
    "boss3_kill": (None, None),   # 可更快，但二轮须仍有 ≥1 次调整（§2.2 注）
}
MILESTONE_NAMES = {
    "realm2": "到达境界 2", "boss1_kill": "击败 Boss 1",
    "boss2_arrive": "抵达 Boss 2", "boss3_kill": "击败 Boss 3",
}
COMPLETION_TARGET = 0.80         # 标准 1
REDEEM_TARGET_S = 30             # §2.5 落地兑现
MAX_GAP_TARGET_MIN = 5.0         # §2.6 节拍红线
ADJUST_EVENTS = {"wugong_upgraded", "realm_breakthrough", "route_changed", "mech_node_bought"}
PROGRESS_EVENTS = {"charge_segment_full", "realm_breakthrough", "stage_first_clear",
                   "wugong_upgraded", "mech_node_bought"}   # + key_battle_end(win)，见 §2.6


def load_tester(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    events = sorted(data.get("events", []), key=lambda e: e["ts"])
    meta = data.get("meta", {})
    return meta, events


def pause_intervals(events):
    """test_paused → test_resumed 配对；未闭合的暂停延伸到最后一个事件。"""
    spans, start = [], None
    for e in events:
        if e["e"] == "test_paused" and start is None:
            start = e["ts"]
        elif e["e"] == "test_resumed" and start is not None:
            spans.append((start, e["ts"]))
            start = None
    if start is not None and events:
        spans.append((start, events[-1]["ts"]))
    return spans


def paused_overlap_ms(spans, a, b):
    return sum(max(0, min(b, r) - max(a, p)) for p, r in spans) if b > a else 0


class Tester:
    """单个测试者的全部派生指标。"""

    def __init__(self, meta, events):
        self.id = meta.get("tester_id", "?")
        self.meta = meta
        self.events = events
        self.spans = pause_intervals(events)
        self.run_starts = {e["run"]: e["ts"] for e in events if e["e"] == "run_start"}
        ends = [e for e in events if e["e"] == "test_session_end"]
        self.end_reason = ends[-1]["reason"] if ends else None
        self.warnings = []
        if not ends:
            self.warnings.append("缺 test_session_end：无法归入分母口径，请观察员补录")

    def net_s(self, ts, run):
        """轮内净时间（秒）= ts − run_start.ts − 暂停重叠（§2 总则）。"""
        t0 = self.run_starts.get(run)
        if t0 is None:
            return None
        return (ts - t0 - paused_overlap_ms(self.spans, t0, ts)) / 1000

    def net_between_s(self, ts_a, ts_b):
        return (ts_b - ts_a - paused_overlap_ms(self.spans, ts_a, ts_b)) / 1000

    # ---- §2.1 标准 1 ----
    def in_denominator(self):
        return self.end_reason in ("completed", "design_dropout")

    def retired_run1(self):
        for e in self.events:
            if e["e"] == "retire_confirmed" and e["run"] == 1:
                return e
        return None

    # ---- §2.2 标准 5：四里程碑轮内净时间 ----
    def milestone_time(self, key, run):
        for e in self.events:
            if e["run"] != run:
                continue
            if key == "realm2" and e["e"] == "realm_breakthrough" and e.get("realm_to") == 2:
                return self.net_s(e["ts"], run)
            if key == "boss1_kill" and e["e"] == "key_battle_end" \
               and e.get("target") == "boss1" and e.get("result") == "win":
                return self.net_s(e["ts"], run)
            if key == "boss2_arrive" and e["e"] == "key_battle_end" \
               and e.get("target") == "boss2" and e.get("attempt") == 1:
                return self.net_s(e["ts"], run)
            if key == "boss3_kill" and e["e"] == "key_battle_end" \
               and e.get("target") == "boss3" and e.get("result") == "win":
                return self.net_s(e["ts"], run)
        return None

    def speedups(self):
        out = {}
        for key in SPEEDUP_TARGETS:
            t1, t2 = self.milestone_time(key, 1), self.milestone_time(key, 2)
            out[key] = (t1, t2, 1 - t2 / t1 if t1 and t2 else None)
        return out

    # ---- §2.3 标准 3：失败→下次挑战之间的调整 ----
    def adjustments(self):
        """返回 {target: [(是否调整后重试, 调整事件数), ...]}（boss2/boss3）。"""
        out = {}
        for target in ("boss2", "boss3"):
            battles = [e for e in self.events
                       if e["e"] == "key_battle_end" and e.get("target") == target]
            retries = []
            for i, e in enumerate(battles):
                if e.get("result") != "lose" or i + 1 >= len(battles):
                    continue
                nxt = battles[i + 1]
                n_adj = sum(1 for x in self.events
                            if x["e"] in ADJUST_EVENTS and e["ts"] < x["ts"] < nxt["ts"])
                retries.append((n_adj > 0, n_adj))
            out[target] = retries
        return out

    def std3_pass(self):
        return any(adj for rs in self.adjustments().values() for adj, _ in rs)

    def pure_retry_streaks(self):
        """同一 Boss 连续纯重试 ≥3 次 → §10.2「只是在等/无脑连点」信号。"""
        flags = []
        for target, rs in self.adjustments().items():
            streak = best = 0
            for adj, _ in rs:
                streak = 0 if adj else streak + 1
                best = max(best, streak)
            if best >= 3:
                flags.append(f"{target} 连续纯重试 {best} 次")
        return flags

    # ---- §2.4 标准 4 ----
    def std4(self):
        run2 = 2 in self.run_starts
        unlocked = next((e for e in self.events if e["e"] == "retire_unlocked"), None)
        confirmed = next((e for e in self.events if e["e"] == "retire_confirmed"), None)
        hesitation = self.net_between_s(unlocked["ts"], confirmed["ts"]) \
            if unlocked and confirmed else None
        previews = sum(1 for e in self.events if e["e"] == "retire_preview_opened")
        cancels = sum(1 for e in self.events if e["e"] == "retire_cancelled")
        return run2, hesitation, previews, cancels

    # ---- §2.5 峰终兑现 ----
    def redeem_delay_s(self):
        confirmed = next((e for e in self.events if e["e"] == "retire_confirmed"), None)
        if not confirmed:
            return None
        first = next((e for e in self.events
                      if e["e"] == "prestige_node_bought" and e["ts"] >= confirmed["ts"]), None)
        return self.net_between_s(confirmed["ts"], first["ts"]) if first else None

    # ---- §2.6 节拍红线 ----
    def max_gap_min(self, run):
        prog = [e["ts"] for e in self.events if e["run"] == run and (
            e["e"] in PROGRESS_EVENTS
            or (e["e"] == "key_battle_end" and e.get("result") == "win"))]
        if len(prog) < 2:
            return None, None
        gaps = [self.net_between_s(a, b) for a, b in zip(prog, prog[1:])]
        lead = self.net_s(prog[0], run)   # 开局→首个进展（规格未列入指标，超红线时单独提示）
        return max(gaps) / 60, (lead / 60 if lead is not None else None)

    # ---- §2 总则交叉校验 ----
    def duration_crosscheck(self):
        e = self.retired_run1()
        if not e or "run_duration_s" not in e:
            return None
        by_ts = self.net_s(e["ts"], e["run"])
        return e["run_duration_s"], by_ts, abs(e["run_duration_s"] - by_ts) if by_ts else None


def fmt_min(sec):
    return "—" if sec is None else f"{sec / 60:.1f}min"


def mark(ok):
    return "✓" if ok else "✗"


def report_tester(t):
    print(f"\n== 测试者 {t.id} ==")
    for w in t.warnings:
        print(f"  ⚠ {w}")
    retired = t.retired_run1()
    print(f"  会话结束: {t.end_reason or '—'} | 计入分母: {'是' if t.in_denominator() else '否（external_dropout/缺失）'}")
    if retired:
        print(f"  首轮归隐: kind={retired.get('kind')} 声望 +{retired.get('prestige_total')}"
              f"（基础 {retired.get('prestige_base')} 表现 +{retired.get('perf_bonus_pct')}%）")
    else:
        print("  首轮归隐: 未达成")
    cc = t.duration_crosscheck()
    if cc:
        print(f"  run_duration_s 交叉校验: 埋点 {cc[0]}s vs ts 差扣暂停 {cc[1]:.0f}s（Δ{cc[2]:.1f}s）"
              + ("" if cc[2] < 5 else " ⚠ 偏差过大，检查暂停配对"))

    adj = t.adjustments()
    n_adj = sum(1 for rs in adj.values() for a, _ in rs if a)
    n_pure = sum(1 for rs in adj.values() for a, _ in rs if not a)
    print(f"  标准3 调整后重试: {mark(t.std3_pass())}（调整后重试 {n_adj} 次 / 纯重试 {n_pure} 次）")
    for flag in t.pure_retry_streaks():
        print(f"    ⚠ §10.2 信号: {flag}")

    run2, hes, pv, cc2 = t.std4()
    print(f"  标准4 二轮意愿: 开二轮 {mark(run2)} | 归隐犹豫 {fmt_min(hes)} | 预览 {pv} 开 / {cc2} 取消")

    rd = t.redeem_delay_s()
    if rd is not None:
        print(f"  §2.5 落地兑现: {rd:.0f}s（目标 ≤{REDEEM_TARGET_S}s {mark(rd <= REDEEM_TARGET_S)}）")
    elif retired:
        print("  §2.5 落地兑现: 归隐后未购节点 ✗")

    for run in sorted(t.run_starts):
        g, lead = t.max_gap_min(run)
        if g is None:
            continue
        line = f"  §2.6 第 {run} 轮最大无进展间隔: {g:.1f}min（红线 ≤{MAX_GAP_TARGET_MIN:.0f}min {mark(g <= MAX_GAP_TARGET_MIN)}）"
        if lead is not None and lead > MAX_GAP_TARGET_MIN:
            line += f" ⚠ 开局→首个进展 {lead:.1f}min"
        print(line)

    if run2:
        print("  标准5 二轮提速（提速比 = 1 − t₂/t₁）:")
        for key, (t1, t2, sp) in t.speedups().items():
            lo, hi = SPEEDUP_TARGETS[key]
            name = MILESTONE_NAMES[key]
            if sp is None:
                print(f"    {name}: t1={fmt_min(t1)} t2={fmt_min(t2)} → —（里程碑缺轮次数据）")
                continue
            if lo is None:
                verdict = "（不设区间；核验二轮 ≥1 次调整）"
            else:
                verdict = f"（目标 {lo:.0%}–{hi:.0%} {mark(lo <= sp <= hi)}）"
            print(f"    {name}: {fmt_min(t1)} → {fmt_min(t2)} 提速 {sp:.0%} {verdict}")


def report_aggregate(testers):
    print("\n== 汇总 ==")
    denom = [t for t in testers if t.in_denominator()]
    numer = [t for t in denom if t.retired_run1()]
    n_ext = len(testers) - len(denom)
    if denom:
        rate = len(numer) / len(denom)
        print(f"  标准1 首次归隐完成率: {len(numer)}/{len(denom)} = {rate:.0%}"
              f"（目标 >{COMPLETION_TARGET:.0%} {mark(rate > COMPLETION_TARGET)}）"
              + (f"；另有 {n_ext} 人 external_dropout/缺失剔除" if n_ext else ""))
        fb = [t for t in numer if t.retired_run1().get("kind") == "fallback"]
        if numer:
            ratio = len(fb) / len(numer)
            print(f"  附报 fallback 占比: {len(fb)}/{len(numer)}"
                  + ("  ⚠ >1/3，按 §10.2「首次归隐不可达」复查曲线" if ratio > 1 / 3 else ""))
    if len(denom) < 10:
        print(f"  ⚠ n={len(denom)} < 10：小样本，按测试方案 §2 以 x/n + 定性结论报告，不报百分比结论")

    # §2.7 标准 6：route × tags 分层（跨测试者）
    layer = {}
    for t in testers:
        for e in t.events:
            if e["e"] != "key_battle_end" or not e.get("tags"):
                continue
            for tag in e["tags"]:
                k = (e.get("route") or "无路线", tag)
                w, n = layer.get(k, (0, 0))
                layer[k] = (w + (1 if e.get("result") == "win" else 0), n + 1)
    if layer:
        print("  §2.7 标准6 route × tags 胜率分层（交叉验证用，主判在问卷/观察）:")
        for (route, tag), (w, n) in sorted(layer.items()):
            print(f"    {route} × {tag}: {w}/{n}")


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    testers = []
    for path in argv[1:]:
        meta, events = load_tester(path)
        testers.append(Tester(meta, events))
    for t in testers:
        report_tester(t)
    report_aggregate(testers)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
