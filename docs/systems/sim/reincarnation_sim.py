#!/usr/bin/env python3
"""
转世时间线求解器 —— 寿元 / 年岁 / 江湖历 / 转世 的判据复核。

设计来源：docs/systems/reincarnation/design.md（§1 时间与纪元 / §2 寿元 / §3 转世）、spec.md §8。

它做什么（2026-09-29 多天一世改写）：
    寿元与年岁速率已由 pacing_sim 按「各阶段一世活几天」解出，每一世在寿终时自动归隐。
    本脚本读 pacing_sim 推演出的标准玩家每一世（LIVES），复核 V1–V7：
    一世的长度与年龄是否落在武侠范畴、重伤折寿与魂魄未稳的力度、江湖历跨度。

    旧版读 pace_measured.json（真实代码实测的世时长）反解年岁速率——那是「一小时一世」
    压缩原型的做法。长线里一世多长由寿元决定，不再从实测世时长反解。

依赖方向（不可颠倒）：
    pacing_sim（寿元上限、年岁速率、每一世的起止）→ 本脚本（只复核，不改数）

用法：python3 docs/systems/sim/reincarnation_sim.py
"""
from __future__ import annotations
import io
import contextlib

with contextlib.redirect_stdout(io.StringIO()):
    import pacing_sim as ps

JIANGHU_ERA_START = 100   # 第一世出生时的江湖历年份
LIFESPAN_LOSS_HEAVY = 15  # 重伤折寿年数（injury/spec.md §6，与 injury.ts 同一个数）
WEAK_MULT = 0.60          # 魂魄未稳：产出 ×0.6（spec.md §4.1）
WEAK_YEARS = 10           # 魂魄未稳：转世后前 10 年（spec.md §4.1）
WUXIA_MAX_AGE = 150       # 武侠范畴的寿元上限（仙侠另议）
# V6 取样：各阶段中段、离线时段（在线后 8 小时）战死一次
DEATH_PROBES = [4.5, 10.5, 15.5, 30.5, 40.5, 60.5, 70.5, 85.5]


def timeline():
    """标准玩家前 100 天的每一世：阶段、世长（天）、寿终年龄、江湖历起止"""
    era = JIANGHU_ERA_START
    out = []
    for i, life in enumerate(ps.LIVES, 1):
        if life.start >= 100:
            break
        span_days = life.end - life.start
        years = life.age_end - ps.INIT_AGE      # 世内首达新境界即换速率，pacing_sim.play 已逐刻累计
        out.append(dict(run=i, stage=life.peak_at_start, days=span_days, age=ps.INIT_AGE + years,
                        era_start=era, era_end=era + years))
        era += years
    return out


def criteria_report():
    print("=" * 72)
    print("转世时间线 sim —— 判据 V1–V7（多天一世）")
    print("=" * 72)
    tl = timeline()

    print("\n----- 各阶段的一世 -----")
    print(f"  {'阶段':<6}{'目标世长':>8}{'实际世长':>16}{'寿终年龄':>14}{'世数':>6}")
    stages = sorted({L["stage"] for L in tl})
    for p in stages:
        ls = [L for L in tl if L["stage"] == p]
        ds = [L["days"] for L in ls]
        ages = [L["age"] for L in ls]
        print(f"  境界 {p:<3}{ps.LIFE_DAYS[min(p, 5)]:>7g} 天{min(ds):>8.2f}–{max(ds):.2f} 天"
              f"{min(ages):>8.0f}–{max(ages):.0f} 岁{len(ls):>6}")
    print(f"  前 100 天 {len(tl)} 世，江湖历 {tl[0]['era_start']:.0f} → {tl[-1]['era_end']:.0f} 年")

    # V1：寿终节奏——各阶段一世的长度落在目标世长到多一天之间（首达新境界那一世寿元跳升，会长一些）
    v1 = all(ps.LIFE_DAYS[min(L["stage"], 5)] - 0.05 <= L["days"] <= ps.LIFE_DAYS[min(L["stage"], 5)] + 1
             for L in tl if L["stage"] >= 2)
    # V2：一次重伤折寿不毁掉一世——折掉的年数 ≤ 本阶段一世跨度的三成
    loss = {p: LIFESPAN_LOSS_HEAVY / (ps.LIFESPAN[min(p, 5)] - ps.INIT_AGE) for p in range(2, 6)}
    v2 = max(loss.values()) <= 0.30
    # V3：寿终年龄落在武侠范畴
    ages = [L["age"] for L in tl]
    v3 = 60 <= min(ages) and max(ages) <= WUXIA_MAX_AGE + 0.5   # 推演步长 15 分钟，寿终时刻最多越过半岁
    # V4：六世累计江湖历跨度 ≥200 年（取前六世）
    six = tl[5]["era_end"] - tl[0]["era_start"]
    v4 = six >= 200
    # V5：在线离线同速率（构造成立：年岁只看游戏内时长）
    v5 = True
    # V6：战死有感不致命（v1.5 改口径：多天一世后，战死的代价主要是本世就此中断，
    #   魂魄未稳只是附加）——在各阶段中段战死一次，下一个里程碑晚 1–5 天（至多一世）
    base_first = ps.STANDARD["first"]
    death_cost = {}
    for t_die in DEATH_PROBES:
        f = ps.play(ps.NEED, ps.SUHUI, die_at=t_die, weak_years=WEAK_YEARS, weak_mult=WEAK_MULT, days=260)["first"]
        nxt = min(x for x in base_first if base_first[x] > t_die)
        death_cost[t_die] = (nxt, f.get(nxt, 999) - base_first[nxt])
    delays = [v for _, v in death_cost.values()]
    v6 = max(delays) <= 5 and sum(delays) / len(delays) >= 1
    # V7：不叠加（构造成立：布尔标记）
    v7 = True

    print("\n----- V2 重伤折寿（15 年）占一世跨度 -----")
    for p, v in loss.items():
        print(f"  阶段 {p}：{v:.0%}")
    print("\n----- V6 战死一次（含魂魄未稳前 10 年 ×0.6）的代价 -----")
    for t_die, (nxt, dl) in death_cost.items():
        print(f"  第 {t_die:>5.2f} 天战死 → 境界 {nxt} 晚 {dl} 天")

    print("\n----- 判据 -----")
    for label, ok, note in [
        ("V1 寿终节奏（各阶段世长 ∈ [目标, 目标 + 1 天]）", v1, ""),
        ("V2 一次重伤折寿 ≤ 一世跨度的三成", v2, f"最重 {max(loss.values()):.0%}"),
        ("V3 寿终年龄 ∈ [60, 150] 岁（武侠范畴）", v3, f"实际 {min(ages):.0f}–{max(ages):.0f} 岁"),
        ("V4 六世累计江湖历跨度 ≥200 年", v4, f"实际 {six:.0f} 年"),
        ("V5 在线离线同速率（年岁与配比无关）", v5, "构造成立"),
        ("V6 战死有感不致命（下一里程碑平均晚 ≥1 天、最多晚 5 天）", v6,
         f"晚 {min(delays)}–{max(delays)} 天，平均 {sum(delays) / len(delays):.1f} 天"),
        ("V7 魂魄未稳不叠加", v7, "构造成立"),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")


if __name__ == "__main__":
    criteria_report()
