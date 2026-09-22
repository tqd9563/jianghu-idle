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
#   N：周天段数；首段配额；总额；
#   meridians：本境界各经脉的穴数，按 §3.2 书写次序（也是松动次序）
#   突破门槛 = 贯通首条经脉（design.md §4），所需穴数 M = meridians[0]
# ─────────────────────────────────────────────────────────────

REALMS = [
    # 境界, N, 首段配额,   总额,        各脉穴数
    (2,     3,   555_714,   3_890_000,  [2, 2]),      # 手阳明 / 手少阴
    (3,     4,   753_333,  11_300_000,  [3, 2]),      # 足阳明 / 足太阴
    (4,     6,   466_667,  29_400_000,  [3, 3]),      # 任脉 / 足少阴
    (5,     8,   248_235,  63_300_000,  [3, 3, 2]),   # 督脉 / 冲脉 / 带脉
]

REQUIRED_MERIDIANS = 1  # 突破须贯通的经脉条数（按次序取前几条）

RATIO = 2  # 段间公比（design.md §3.1）

# ─────────────────────────────────────────────────────────────
# 冲穴参数（design.md §3.3，候选值——甲的数值待拍板，调这里重跑）
#   按「脉内位次」定：越靠后的穴，成功率越低、所需真气越多
#   所需真气 = 当前段配额 × T；T = (T_BASE + T_STEP×(位次−1)) × REALM_MUL^(境界−2)
#   松动即可冲（T ≤ 100%，永远装得下）；冲即扣，失败白扣
# ─────────────────────────────────────────────────────────────

P_BASE, P_STEP, P_FLOOR = 0.90, 0.10, 0.50   # 成功率：第 1 穴 90%，每往后一穴 −10pp，最低 50%
T_BASE, T_STEP = 0.11, 0.05                  # 所需真气基础比例：第 1 穴 11%，每往后一穴 +5%
REALM_MUL = 1.2                              # 境界乘数：所需真气比例 × 1.2^(境界−2)

FAIL_BONUS_PP = 0.10   # 同穴每失败一次，下次 +10pp（累进保留，必成兜底废止）


def p_of(pos: int) -> float:
    return max(P_FLOOR, P_BASE - P_STEP * (pos - 1))


def t_of(pos: int, realm: int) -> float:
    return min(1.0, (T_BASE + T_STEP * (pos - 1)) * REALM_MUL ** (realm - 2))

SIM_RUNS = 20000


# ─────────────────────────────────────────────────────────────
# 单境界模拟
# ─────────────────────────────────────────────────────────────

def quota(first: int, seg: int) -> int:
    """第 seg 段（1 起）的配额。"""
    return first * RATIO ** (seg - 1)


def loosen_segs(N, M):
    """突破所需的 M 个穴各自松动后所在的当前段：最后 M 段依次松动（design.md §2）。
    第 k 穴（1 起）在第 N−M+k 段圆满后松动，当时的当前段 = N−M+k+1，封顶 N（末段）。"""
    return [min(N - M + k + 1, N) for k in range(1, M + 1)]


def required_sequence(meridians):
    """突破所需窍穴的脉内位次序列：前 REQUIRED_MERIDIANS 条脉逐穴展开。"""
    return [k for size in meridians[:REQUIRED_MERIDIANS] for k in range(1, size + 1)]


def simulate_realm(realm, N, first, total, sequence, runs=SIM_RUNS):
    """
    返回每次模拟的「冲穴总花费 / 境界总额」列表。

    玩家策略（最省）：只冲突破所需的 M 个穴；每个穴一松动就攒够即冲，
    失败继续攒再冲，直到通。所需真气按松动时所在段的配额计。
    """
    M = len(sequence)
    segs = loosen_segs(N, M)
    results = []
    for _ in range(runs):
        spent = 0
        for j in range(M):
            pos = sequence[j]
            p0 = p_of(pos)
            cost = quota(first, segs[j]) * t_of(pos, realm)
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
    print("\n冲穴参数：成功率 = max(50%, 90% − 10pp×(位次−1))；"
          "所需真气 = 当前段配额 × (11% + 5%×(位次−1)) × 1.2^(境界−2)")

    print(f"\n{'境界':>4} {'N':>3} {'M':>3} {'附加中位':>8} {'附加P95':>8} {'P95/中位':>8} {'最长':>8} {'松动段':>12} {'各穴所需真气占池':>18}")
    print("-" * 96)
    medians = []
    all_pass = True
    rows = []
    for realm, N, first, total, meridians in REALMS:
        seq = required_sequence(meridians)
        M = len(seq)
        r = simulate_realm(realm, N, first, total, seq)
        med = statistics.median(r)
        p95 = sorted(r)[int(len(r) * 0.95)]
        worst = max(r)
        medians.append(med)
        # 总时长比 = (1 + 附加)；坏运比 = (1+p95)/(1+med)
        bad_ratio = (1 + p95) / (1 + med)
        segs = loosen_segs(N, M)
        ts = [t_of(seq[j], realm) for j in range(M)]
        fits = all(t <= 1.0 for t in ts)
        rows.append((realm, med, p95, bad_ratio, worst, fits))
        print(f"{realm:>4} {N:>3} {M:>3} {med:>8.1%} {p95:>8.1%} {bad_ratio:>8.2f} {worst:>8.1%} "
              f"{'/'.join(str(N - M + k) for k in range(1, M + 1)):>12} {' '.join(f'{t:.0%}' for t in ts):>18}")

    # W1 无死锁：内力持续产出可无限重试；所需真气 ≤ 当前段配额（松动即可冲）
    w1 = all(w < float("inf") and fits for _, _, _, _, w, fits in rows)
    # W2 附加时间占账期比例中位落在 [15%, 50%]
    w2 = all(0.15 <= med <= 0.50 for _, med, *_ in rows)
    # W3 坏运不惨：P95 总时长 ≤ 中位总时长 × 1.5
    w3 = all(br <= 1.5 for _, _, _, br, *_ in rows)
    # W4 越往上越难：附加占比中位随境界非递减
    w4 = all(medians[i] <= medians[i + 1] + 1e-9 for i in range(len(medians) - 1))

    print("\n----- 判据 -----")
    for label, ok, note in [
        ("W1 无死锁（内力持续产出可重试；所需真气 ≤ 当前段配额）", w1,
         " / ".join(f"境界{r} ok" if fits else f"境界{r} 超池" for r, *_, fits in rows)),
        ("W2 冲穴附加时间中位 ∈ [15%, 50%] 账期", w2,
         " / ".join(f"境界{r} {m:.0%}" for r, m, *_ in rows)),
        ("W3 坏运 P95 总时长 ≤ 中位 × 1.5", w3,
         " / ".join(f"境界{r} {br:.2f}" for r, _, _, br, *_ in rows)),
        ("W4 附加占比随境界非递减", w4, ""),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")
        all_pass = all_pass and ok

    print("\n" + "=" * 72)
    print("总结：全部 PASS" if all_pass else "总结：存在 FAIL 项，调 T_BASE/T_STEP/REALM_MUL 重跑")
    print("=" * 72)
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
