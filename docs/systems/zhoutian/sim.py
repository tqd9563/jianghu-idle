#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
周天 · 经脉 · 窍穴系统 v4 验算模拟器 —— 「冲穴耗内力」制

设计来源：zhoutian/design.md v4.0 §2（核心循环）/ §3.3（冲穴参数）/ §3.4（判据 W1–W4）。

它回答的问题：
    冲穴不再靠「机会」，而是从当前周天扣内力。那么在一个境界里，
    为了通够突破所需的窍穴，玩家平均要多付多少内力（= 多花多少时间）？
    坏运气的人会不会被拖得太惨？难度是否随境界上升？

时间口径：
    一切按「基准时长」折算——境界总额 ÷ 基础产出（M=1 口径，design.md §3.1）。
    冲穴花掉的内力全部从当前段扣，所以附加时间 = 冲穴总花费 ÷ 产出速率，
    与账期时间（= 总额 ÷ 产出速率）同口径，直接可比。

用法：python3 docs/systems/zhoutian/sim.py
无依赖，纯标准库。
"""

import random
import statistics
import sys

# ─────────────────────────────────────────────────────────────
# 境界表（design.md §3.1 / §3.2）
#   N：周天段数；首段配额；总额；突破所需已通窍穴 M；
#   sequence：本境界窍穴的松动次序（真气行经次序），每项为该穴在其经脉内的位次（1 起）
# ─────────────────────────────────────────────────────────────

REALMS = [
    # 境界, N, 首段配额,   总额,        M, 松动次序（脉内位次）
    (2,     3,   555_714,   3_890_000,  2, [1, 2, 1, 2]),          # 手阳明 2 穴 / 手少阴 2 穴
    (3,     4,   753_333,  11_300_000,  2, [1, 2, 3, 1, 2]),       # 足阳明 3 穴 / 足太阴 2 穴
    (4,     6,   466_667,  29_400_000,  3, [1, 2, 3, 1, 2, 3]),    # 任脉 3 穴 / 足少阴 3 穴
    (5,     8,   248_235,  63_300_000,  4, [1, 2, 3, 1, 2, 3, 1, 2]),  # 督脉 3 / 冲脉 3 / 带脉 2
]

RATIO = 2  # 段间公比（design.md §3.1）

# ─────────────────────────────────────────────────────────────
# 冲穴参数（design.md §3.3，候选值——甲的数值待拍板，调这里重跑）
#   按「脉内位次」定：越靠后的穴，成功率越低、所需真气越多
#   T：所需真气 = 本境界总额 × T；当前段蓄到这个数才能冲，冲即扣，失败白扣
#   （锚在总额而非当前段：前几段配额只占总额零头，按段计价会让高境界冲穴反而便宜）
# ─────────────────────────────────────────────────────────────

ACUPOINT_BY_POS = {
    # 位次: (成功率 p, 所需真气占本境界总额 T)
    1: (0.90, 0.06),
    2: (0.80, 0.09),
    3: (0.70, 0.12),
}

FAIL_BONUS_PP = 0.10   # 同穴每失败一次，下次 +10pp（累进保留，必成兜底废止）

SIM_RUNS = 20000


# ─────────────────────────────────────────────────────────────
# 单境界模拟
# ─────────────────────────────────────────────────────────────

def quota(first: int, seg: int) -> int:
    """第 seg 段（1 起）的配额。"""
    return first * RATIO ** (seg - 1)


def affordable_seg(first, N, cost):
    """最早能装下 cost 的段号（配额 ≥ cost）；末段也装不下返回 None。"""
    for seg in range(1, N + 1):
        if quota(first, seg) >= cost:
            return seg
    return None


def simulate_realm(realm, N, first, total, M, sequence, runs=SIM_RUNS):
    """
    返回每次模拟的「冲穴总花费 / 境界总额」列表。

    玩家策略（最省）：只冲突破所需的前 M 个穴；每个穴一松动就开始攒，
    攒够 T 立刻冲，失败继续攒再冲，直到通。
    松动规则：第 k 段圆满松动第 k 穴；末段圆满时余下全部松动（design.md §2）。
    所需真气锚在本境界总额；当前段配额不够装时，要等丹田扩容（见 affordable_seg）。
    """
    results = []
    for _ in range(runs):
        spent = 0
        for j in range(M):
            pos = sequence[j]
            p0, T = ACUPOINT_BY_POS[pos]
            cost = total * T
            fails = 0
            while True:
                spent += cost
                p = min(1.0, p0 + FAIL_BONUS_PP * fails)
                if random.random() < p:
                    break
                fails += 1
        results.append(spent / total)
    return results


# ─────────────────────────────────────────────────────────────
# 判据 W1–W4
# ─────────────────────────────────────────────────────────────

def main():
    random.seed(42)
    print("=" * 72)
    print("周天 v4 · 冲穴耗内力制 验算（design.md §3.4 判据 W1–W4）")
    print("=" * 72)
    print("\n冲穴参数（脉内位次 → 成功率 / 所需真气占本境界总额）")
    for pos, (p, T) in ACUPOINT_BY_POS.items():
        print(f"  第{pos}穴  p={p:.0%}  T={T:.0%}")

    print(f"\n{'境界':>4} {'N':>3} {'M':>3} {'附加中位':>8} {'附加P95':>8} {'P95/中位':>8} {'最长':>8} {'可冲段':>10}")
    print("-" * 68)
    medians = []
    all_pass = True
    rows = []
    for realm, N, first, total, M, seq in REALMS:
        r = simulate_realm(realm, N, first, total, M, seq)
        med = statistics.median(r)
        p95 = sorted(r)[int(len(r) * 0.95)]
        worst = max(r)
        medians.append(med)
        # 总时长比 = (1 + 附加)；坏运比 = (1+p95)/(1+med)
        bad_ratio = (1 + p95) / (1 + med)
        segs = [affordable_seg(first, N, total * ACUPOINT_BY_POS[seq[j]][1]) for j in range(M)]
        fits = all(s is not None for s in segs)
        rows.append((realm, med, p95, bad_ratio, worst, fits))
        print(f"{realm:>4} {N:>3} {M:>3} {med:>8.1%} {p95:>8.1%} {bad_ratio:>8.2f} {worst:>8.1%} "
              f"{'/'.join(str(s) for s in segs):>10}")

    # W1 无死锁：每次模拟都在有限步内通够 M 穴（循环必终止，此处断言最长花费有限）
    w1 = all(w < float("inf") and fits for _, _, _, _, w, fits in rows)
    # W2 附加时间占账期比例中位落在 [15%, 50%]
    w2 = all(0.15 <= med <= 0.50 for _, med, *_ in rows)
    # W3 坏运不惨：P95 总时长 ≤ 中位总时长 × 1.5
    w3 = all(br <= 1.5 for _, _, _, br, *_ in rows)
    # W4 越往上越难：附加占比中位随境界非递减
    w4 = all(medians[i] <= medians[i + 1] + 1e-9 for i in range(len(medians) - 1))

    print("\n----- 判据 -----")
    for label, ok, note in [
        ("W1 无死锁（内力持续产出可重试；所需真气末段装得下）", w1,
         " / ".join(f"境界{r} 可冲段 ok" if fits else f"境界{r} 装不下" for r, *_, fits in rows)),
        ("W2 冲穴附加时间中位 ∈ [15%, 50%] 账期", w2,
         " / ".join(f"境界{r} {m:.0%}" for r, m, *_ in rows)),
        ("W3 坏运 P95 总时长 ≤ 中位 × 1.5", w3,
         " / ".join(f"境界{r} {br:.2f}" for r, _, _, br, *_ in rows)),
        ("W4 附加占比随境界非递减", w4, ""),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")
        all_pass = all_pass and ok

    print("\n" + "=" * 72)
    print("总结：全部 PASS" if all_pass else "总结：存在 FAIL 项，调 ACUPOINT_BY_POS 重跑")
    print("=" * 72)
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
