#!/usr/bin/env python3
"""
节奏求解器（pacing solver）—— 长线节奏与声望经济的唯一数值源。

依赖方向（不可颠倒）：
    里程碑表（体验目标）
      → 乘区成长要求 M(d)
        → 各境界内力总额  → 境界内周天配额
        → 宿慧表（首达奖励）
        → 声望经济要求（每轮声望产出 / 节点定价）

改里程碑或任一外生假设后重跑本脚本，所有数值再生；
禁止手工在 design.md / economy.md 里改单个数字。

用法：python3 docs/systems/sim/pacing_sim.py
"""
from __future__ import annotations
import math

# ═══════════════════════════════════════════════════════════
# 输入 1：体验目标（唯一的源）
# ═══════════════════════════════════════════════════════════

# 首次「摸到」该境界的天数（第 1 天 = 开服首日）
MILESTONE_DAY: dict[int, int] = {2: 1, 3: 7, 4: 21, 5: 50, 6: 100}

# ═══════════════════════════════════════════════════════════
# 输入 2：外生假设（拍板项，改动会整体缩放）
# ═══════════════════════════════════════════════════════════

E_HOURS = 16.0          # 标准玩家每日有效产出时长（在线 + 离线折算）
OFFLINE_EFF = 0.60      # 离线效率：4h 在线 + 20h 离线 × 60% = 16h ✓
RETIRES_PER_DAY = 1.0   # 归隐频率
SUHUI_SHARE = 0.60      # 乘区成长中由「宿慧」（首达奖励）交付的比例，其余由声望阁

# 周天段数与配额公比
ZHOUTIAN_N: dict[int, int] = {1: 4, 2: 3, 3: 4, 4: 6, 5: 8}
QUOTA_RATIO = 2.0       # 境界内每个周天的配额是上一个的 2 倍

# 产出类节点（声望阁「修行感悟」）：第 n 级 +NODE_GAIN 基础产出，价格 = NODE_P0 × n
NODE_GAIN = 0.10
NODE_P0 = 10.0          # 声望；由表五闭式解反标定——基础声望系数 c = NODE_P0

def rate(realm: int) -> float:
    """基础挂机产出/秒（现行公式，本次不改）"""
    return 9 * 1.25 ** (realm - 1)

E = E_HOURS * 3600      # 单轮/单日预算（秒）

# ═══════════════════════════════════════════════════════════
# 求解 1：各境界内力总额
#   玩家在第 d 天的乘区 M(d) = d（见求解 2 的构造）
#   「第 d_X 天首次摸到境界 X」⇔ 累计基准时长 BaseTime(X) = E × d_X
# ═══════════════════════════════════════════════════════════

def sig3(v: float) -> int:
    """圆整到 3 位有效数字，便于写进数值表"""
    if v <= 0:
        return 0
    mag = 10 ** (int(math.log10(v)) - 2)
    return int(round(v / mag) * mag)

BASE_TIME = {1: 0.0}                       # 到达境界 X 所需的累计基准时长（秒，M=1 口径）
for x, d in MILESTONE_DAY.items():
    BASE_TIME[x] = E * d

REALM_TOTAL: dict[int, int] = {}           # 停留在境界 r 期间需产出的内力
for r in range(1, 6):
    REALM_TOTAL[r] = sig3((BASE_TIME[r + 1] - BASE_TIME[r]) * rate(r))

def quotas(realm: int) -> list[float]:
    """境界内各周天配额：等比数列，末段 = 该境界总额的一半（公比 2）"""
    n, total = ZHOUTIAN_N[realm], REALM_TOTAL[realm]
    q1 = total / ((QUOTA_RATIO ** n - 1) / (QUOTA_RATIO - 1))
    return [q1 * QUOTA_RATIO ** i for i in range(n)]

# ═══════════════════════════════════════════════════════════
# 求解 2：乘区的两层交付（宿慧 60% + 声望阁 40%）
#   要「在第 d_X 天刚好够得着境界 X」，此刻乘区必须 = d_X，
#   而此刻玩家手上只有境界 2..X-1 的宿慧（X 尚未达成）。
# ═══════════════════════════════════════════════════════════

SHOP_SLOPE = (1 - SUHUI_SHARE)             # 声望阁每天贡献的乘区（线性）
SUHUI: dict[int, float] = {}               # 首达境界 X 的一次性永久产出加成
_acc = 0.0
for x in sorted(MILESTONE_DAY):
    need = SUHUI_SHARE * (MILESTONE_DAY[x] - 1)   # 到达 X 时应持有的宿慧总量
    if x - 1 >= 2:
        SUHUI[x - 1] = need - _acc
        _acc = need

def multiplier(day: float, reached: set[int]) -> float:
    """第 day 天、已首达过 reached 中各境界时的总乘区"""
    return 1 + SHOP_SLOPE * (day - 1) + sum(SUHUI.get(x, 0.0) for x in reached)

# ═══════════════════════════════════════════════════════════
# 求解 3：声望经济
#   声望阁需每天交付 SHOP_SLOPE 的乘区 → 每天买 SHOP_SLOPE/NODE_GAIN 级节点
#   节点第 n 级价 = NODE_P0 × n ⇒ 每日所需声望随天数线性增长
#   ⇒ 归隐声望必须与「本轮内力产出」挂钩，而不能只看到达境界（见输出注解）
# ═══════════════════════════════════════════════════════════

LEVELS_PER_DAY = SHOP_SLOPE / NODE_GAIN

def rep_needed_on_day(day: int) -> float:
    """第 day 天当天需要买下的节点总价 = 当天须获得的声望"""
    lo = LEVELS_PER_DAY * (day - 2) + 1
    hi = LEVELS_PER_DAY * (day - 1)
    n_lo, n_hi = math.ceil(lo), math.floor(hi)
    return NODE_P0 * sum(range(max(1, n_lo), n_hi + 1))

# ═══════════════════════════════════════════════════════════
# 验证：按天推演，检查里程碑是否逐条命中
# ═══════════════════════════════════════════════════════════

def simulate(days: int = 120) -> dict[int, int]:
    reached: set[int] = set()
    first_day: dict[int, int] = {}
    for d in range(1, days + 1):
        m = multiplier(d, reached)
        afford = E * m
        top = max((x for x in BASE_TIME if BASE_TIME[x] <= afford), default=1)
        for x in range(2, top + 1):
            if x not in first_day:
                first_day[x] = d
                reached.add(x)
                m = multiplier(d, reached)          # 首达即时到账，可能连跳
    return first_day


def main() -> None:
    w = 92
    print("═" * w)
    print(f"节奏求解器 · 输入：E={E_HOURS}h/天（离线效率 {OFFLINE_EFF:.0%}）、"
          f"归隐 {RETIRES_PER_DAY:.0f}次/天、宿慧占比 {SUHUI_SHARE:.0%}、周天公比 {QUOTA_RATIO:.0f}")
    print("═" * w)

    print("\n【表一】各境界内力总额与周天配额")
    print(f"{'境界':<4}{'N':>3}{'产出/秒':>9}{'本境界总额':>14}{'断崖':>7}{'基准时长':>10}"
          f"{'首段配额':>12}{'末段配额':>14}")
    print("-" * w)
    prev = None
    for r in range(1, 6):
        q = quotas(r)
        t = REALM_TOTAL[r] / rate(r) / 3600
        cliff = f"{REALM_TOTAL[r]/prev:.1f}×" if prev else "—"
        print(f"{r:<4}{ZHOUTIAN_N[r]:>3}{rate(r):>9.1f}{REALM_TOTAL[r]:>14,}{cliff:>7}"
              f"{t:>9.0f}h{q[0]:>12,.0f}{q[-1]:>14,.0f}")
        prev = REALM_TOTAL[r]

    print("\n【表二】宿慧（首达境界的一次性永久产出加成）")
    print(f"{'首达境界':<10}{'宿慧':>10}{'达成日':>9}{'达成后乘区':>12}{'距下一里程碑':>14}")
    print("-" * 58)
    reached: set[int] = set()
    for x in sorted(SUHUI):
        d = MILESTONE_DAY[x]
        reached.add(x)
        m_after = multiplier(d, reached)
        nxt = MILESTONE_DAY.get(x + 1)
        gap = f"需 {nxt}× · 差 {nxt - m_after:.1f}" if nxt else "—"
        print(f"境界 {x:<7}{'+' + format(SUHUI[x], '.1f') + '×':>10}{'第' + str(d) + '天':>9}"
              f"{m_after:>11.1f}×{gap:>14}")
    print(f"\n  （首达境界 6 的宿慧留待版本天花板上移时再解；"
          f"第 100 天乘区构成：宿慧 {sum(SUHUI.values()):.1f}× + 声望阁 {SHOP_SLOPE*99:.1f}× + 基础 1×）")

    print("\n【表三】声望阁需要交付的指标")
    print(f"  产出类节点「修行感悟」：第 n 级 +{NODE_GAIN:.0%} 基础产出，价格 = {NODE_P0:.0f}P × n")
    print(f"  每天须购入 {LEVELS_PER_DAY:.0f} 级（= 每天 +{SHOP_SLOPE:.1f}× 乘区）")
    print(f"{'第d天':>7}{'当天须得声望':>14}{'累计级数':>10}{'声望阁乘区':>12}")
    print("-" * 45)
    for d in [2, 7, 21, 50, 100]:
        print(f"{d:>7}{rep_needed_on_day(d):>14,.0f}P{LEVELS_PER_DAY*(d-1):>9.0f}"
              f"{SHOP_SLOPE*(d-1):>11.1f}×")
    r2, r100 = rep_needed_on_day(2), rep_needed_on_day(100)
    print(f"\n  声望产出须从第2天的 {r2:.0f}P 增长到第100天的 {r100:,.0f}P（{r100/r2:.0f}×）。")
    print("  ⚠ 关键结论：平台期（如卡在境界 3 的两周）声望仍须逐日增长，")
    print("     故归隐声望必须由「本轮累计内力产出」派生，不能只按到达境界给。")

    print("\n【表五】归隐声望三层公式（与表三联立的闭式解）")
    print("  本轮声望 = 基础声望 × 行为乘数(1.0–1.5, 有界) + 成就声望(一次性表)")
    print(f"  基础声望 = {NODE_P0:.0f} × 本轮乘区加权有效时长(小时)     [闭式解 c = NODE_P0]")
    print("  推导：节点第 n 级价 P0·n、每天购 4 级 ⇒ 累计需求 ≈ 8·P0·(d−1)²；")
    print("       基础声望累计 = 16c·Σd = 8c·d(d+1) ≥ 需求 ⇔ c ≥ P0·(d−1)²/d(d+1) → c = P0。")
    print("  防刷：乘区加权时长与真实时间同速累积，拆轮/速刷不改变日总量。")
    print(f"{'第d天':>7}{'基础声望/轮':>13}{'当天节点开销':>13}{'当日结余':>10}")
    print("-" * 45)
    for d in [1, 2, 7, 21, 50, 100]:
        income = NODE_P0 * d * E_HOURS
        cost = rep_needed_on_day(d)
        print(f"{d:>7}{income:>13,.0f}{cost:>13,.0f}{income - cost:>10,.0f}")
    # 累计口径自检：任意一天累计收入 ≥ 累计开销
    cum_in = cum_out = 0.0
    for d in range(1, 121):
        cum_in += NODE_P0 * d * E_HOURS
        cum_out += rep_needed_on_day(d)
        assert cum_in >= cum_out, f"第{d}天声望入不敷出"
    print("  自检：1–120 天累计收入 ≥ 累计开销 ✓（早期结余供 QoL/战斗类节点与容错）")

    print("\n【表四】验证 · 按天推演")
    first = simulate()
    print(f"{'境界':<6}{'目标日':>8}{'实测日':>8}{'判定':>6}")
    print("-" * 30)
    ok = True
    for x in sorted(MILESTONE_DAY):
        got = first.get(x, -1)
        hit = got == MILESTONE_DAY[x]
        ok &= hit
        print(f"境界 {x:<3}{MILESTONE_DAY[x]:>8}{got:>8}{'✓' if hit else '✗':>6}")
    print(f"\n  里程碑全部命中：{'是' if ok else '否'}")

    print("\n【附】首日体验（境界 1，无声望加成）")
    acc = 0.0
    for i, q in enumerate(quotas(1), 1):
        acc += q
        print(f"  第{i}周天 {q:>10,.0f} 内力 · 本段 {q/rate(1)/3600:>4.1f}h · 累计 {acc/rate(1)/3600:>4.1f}h")

    print("\n【附】玩家画像偏移（离线效率 %.0f%%）" % (OFFLINE_EFF * 100))
    for label, online in [("全天在线", 24.0), ("标准 4h 在线", 4.0), ("轻度 2h 在线", 2.0)]:
        eff = online + (24 - online) * OFFLINE_EFF
        print(f"  {label:<12} 有效 {eff:>4.1f}h/天 → 里程碑 ×{E_HOURS/eff:.2f}"
              f"（境界 6 ≈ 第 {100*E_HOURS/eff:.0f} 天）")


if __name__ == "__main__":
    main()
