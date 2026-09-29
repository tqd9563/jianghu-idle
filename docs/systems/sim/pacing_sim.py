#!/usr/bin/env python3
"""
节奏求解器（pacing solver）—— 长线节奏与声望经济的唯一数值源。

依赖方向（不可颠倒）：
    里程碑表（体验目标）+ 转世节奏（各阶段一世活几天）
      → 寿元上限 + 年岁速率（一世在第几天寿终）
        → 按标准玩家推演每一世 → 乘区 M 的实际轨迹
          → 各境界内力总额  → 境界内周天配额
          → 宿慧表（首达奖励）

改里程碑、转世节奏或任一外生假设后重跑本脚本，所有数值再生；
禁止手工在 design.md / economy.md 里改单个数字。

多天一世（2026-09-29 重开裁决 1，`../pacing/design.md` §2）：
    原模型假设玩家每天归隐一次。但声望只按时间累计、与归隐频率无关，而一世越长攒的内力越多，
    所以最优打法是后期越活越长。现在改为：寿元随当前境界提高、年岁速率随历来最高境界放慢，
    寿终时自动归隐（寿终正寝不受罚）。

按现行代码规则推演（2026-09-29 用户选定「维持丹田封顶」）：
    丹田满了多出的产出散掉，突破只能在线做。所以标准玩家在「寿元撑不到下次上线」的那次上线时，
    先突破、推前沿，再归隐，让新的一世从在线时段起爬，不在夜里寿终、白挂一夜。

用法：python3 docs/systems/sim/pacing_sim.py
"""
from __future__ import annotations
import math

# ═══════════════════════════════════════════════════════════
# 输入 1：体验目标（唯一的源）
# ═══════════════════════════════════════════════════════════

# 首次「摸到」该境界的天数（第 1 天 = 开服首日）
MILESTONE_DAY: dict[int, int] = {2: 1, 3: 7, 4: 21, 5: 50, 6: 100}

# 转世节奏：阶段（历来最高境界）→ 一世活几天（2026-09-29 用户选定方案甲）
LIFE_DAYS: dict[int, int] = {1: 1, 2: 1, 3: 2, 4: 3, 5: 5}

# ═══════════════════════════════════════════════════════════
# 输入 2：外生假设（拍板项，改动会整体缩放）
# ═══════════════════════════════════════════════════════════

ONLINE_H = 4            # 标准玩家每天在线小时（每天同一时刻上线）
E_HOURS = 16.0          # 标准玩家每日有效产出时长（在线 + 离线折算）
OFFLINE_EFF = 0.60      # 离线效率：4h 在线 + 20h 离线 × 60% = 16h ✓
SUHUI_SHARE = 0.20      # 乘区成长中由「宿慧」（首达奖励）交付的比例，其余由声望阁

# 寿元（reincarnation/spec.md §3.1）：初始 18 岁；上限随「当前境界」提高，武侠范畴内不过 150
INIT_AGE = 18
LIFESPAN: dict[int, int] = {1: 70, 2: 70, 3: 90, 4: 110, 5: 130, 6: 150}

# 周天段数与配额公比
ZHOUTIAN_N: dict[int, int] = {1: 4, 2: 3, 3: 4, 4: 6, 5: 8}
QUOTA_RATIO = 2.0       # 境界内每个周天的配额是上一个的 2 倍

# 内力的其它去处（2026-09-28 长线落地第 2 步新增）：
#   境界总额只是「突破要缴的」那部分；同一段时间里产出的内力还要分给冲穴与门径武学。
#   不扣掉它们，里程碑会整体往后漂。两项均为「占该境界全部内力开销」的份额口径。
# 冲穴附加：通够突破所需经脉额外花掉的内力 ÷ 境界总额（../zhoutian/sim.py 中位值，
#   境界 1 教学脉按同一规则另算）
CHONGXUE_OVERHEAD: dict[int, float] = {1: 0.19, 2: 0.15, 3: 0.31, 4: 0.31, 5: 0.37}
# 门径武学份额：标准玩家把全部内力产出的这一比例花在门径武学上（longline_sim.py 标定）
SKILL_SHARE = 0.20

# 声望阁「修行感悟」：第 n 级 +NODE_GAIN 基础产出，价格 = NODE_P0 × n（economy.md §3）
NODE_GAIN = 0.20
NODE_P0 = 10.0          # 声望；基础声望系数 c 同为 10（economy.md §1.1）

# 声望的另两层与另一项开销（2026-09-29 第 6 步补入：真实代码的节奏守卫要对得上，不再当余量）：
FRONT_MULT = 1.2        # 行为乘数「打到自己的前沿」（economy.md §1.2）：首个 Boss 要境界 3，首达境界 3 之后的世才有
FAME_SHARE = 0.05       # 名号与经脉声望约占基础声望的这一比例（longline_sim 表六）
QOL_PRICES = [150, 220, 440, 660, 1100]   # 五件传承（economy.md §4）：前沿乘数与名号多出来的声望先买它们，买齐后并入修行感悟


def rate(realm: int) -> float:
    """基础挂机产出/秒（现行公式，本次不改）"""
    return 9 * 1.25 ** (realm - 1)


E = E_HOURS * 3600      # 一天的有效产出（秒，M=1 口径）


def sig3(v: float) -> int:
    """圆整到 3 位有效数字，便于写进数值表"""
    if v <= 0:
        return 0
    mag = 10 ** (int(math.log10(v)) - 2)
    return int(round(v / mag) * mag)


# ═══════════════════════════════════════════════════════════
# 求解 1：年岁速率
#   阶段 P 的一世活 LIFE_DAYS[P] 天，寿终于境界 P 的寿元。寿元比整天数多留一个在线时段：
#   第 L 天上线时还活着，先突破、推前沿，再归隐——新的一世从在线时段起爬
#   ⇒ 年岁速率 = (寿元 − 18) ÷ (L 天 + 在线时长)
#   速率跟「历来最高境界」走，同一阶段每一世都一样；首达新境界的那一刻起换新速率；
#   境界 6 沿用境界 5 的速率（本版终点）
# ═══════════════════════════════════════════════════════════

def age_rate(peak: int) -> float:
    """年 / 天"""
    p = min(peak, 5)
    return (LIFESPAN[p] - INIT_AGE) / (LIFE_DAYS[p] + ONLINE_H / 24)


# ═══════════════════════════════════════════════════════════
# 推演：标准玩家（按现行代码规则，2026-09-29 用户选定「维持丹田封顶」）
#   · 每天固定在线 ONLINE_H 小时（第 0 小时起），其余离线，离线产出 × OFFLINE_EFF
#   · 丹田上限 = 本境界突破所需；满了多出的产出散掉。突破（含冲穴）只能在线做
#   · 世内乘区 M = 1 + 修行感悟 + 宿慧；修行感悟只在归隐时用本世声望买，宿慧首达即时生效
#   · 归隐时机：上线时若寿元撑不到下次上线，当场归隐——新的一世从在线时段起爬，
#     不在夜里寿终、白挂一夜。否则寿终自动归隐
# 以 NEED[r]（境界 r 要攒的「M 加权有效秒」，含冲穴附加与武学份额）为未知数求解
# ═══════════════════════════════════════════════════════════

STEPS_PER_DAY = 24      # 推演步长 1 小时


class Life:
    __slots__ = ("start", "end", "m_base", "levels", "peak_at_start", "age_end")

    def __init__(self, start: float, m_base: float, levels: int, peak: int):
        self.start, self.end, self.m_base, self.levels, self.peak_at_start = start, start, m_base, levels, peak
        self.age_end = float(INIT_AGE)


def play(need: dict[int, float], suhui: dict[int, float], *, shop_frac: float = 1.0,
         daily: bool = False, days: int = 130, die_at: float | None = None, weak_years: float = 0.0,
         weak_mult: float = 0.6) -> dict:
    """推演 days 天。daily=True 为「每次上线都归隐」的对照玩家；shop_frac 为声望阁只买标准量的比例；
    die_at 为在该时刻（天）战死一次，来世前 weak_years 年产出 × weak_mult（魂魄未稳）。
    返回 first（首达日）、lives（每一世）、levels_by_day（每天开始时的修行感悟级数）。"""
    reached: set[int] = set()
    first: dict[int, int] = {}
    lives: list[Life] = []
    levels_by_day: dict[int, int] = {}
    levels, wallet, extra = 0, 0.0, 0.0
    qol = list(QOL_PRICES)
    k, end_k = 0, days * STEPS_PER_DAY
    dt = 1 / STEPS_PER_DAY
    pending_weak = False
    while k < end_k:
        weak_until = INIT_AGE + weak_years if pending_weak else 0.0
        pending_weak = False
        life = Life(k * dt, 1 + NODE_GAIN * levels, levels, max([1, *reached]))
        lives.append(life)
        age, realm, held, life_rep, life_extra = float(INIT_AGE), 1, 0.0, 0.0, 0.0
        while k < end_k:
            if die_at is not None and k * dt >= die_at:
                die_at, pending_weak = None, True       # 战死：本世就此结束，来世魂魄未稳
                break
            hour = k % STEPS_PER_DAY
            online = hour < ONLINE_H
            if hour == 0:
                levels_by_day[k // STEPS_PER_DAY + 1] = levels
                # 上线先把夜里攒满的突破掉（首达记在当天）
                while realm in need and held >= need[realm]:
                    held -= need[realm]
                    realm += 1
                    if realm not in first:
                        first[realm] = k // STEPS_PER_DAY + 1
                        reached.add(realm)
                # 寿元撑不到下次上线就先归隐（还没到归隐门槛的第一世除外）
                if k > round(life.start * STEPS_PER_DAY) and realm >= 2 and (
                        daily or age + age_rate(max([1, *reached])) >= LIFESPAN[realm]):
                    break
            m = life.m_base + sum(suhui.get(x, 0.0) for x in reached)
            eff = (1.0 if online else OFFLINE_EFF) * (weak_mult if age < weak_until else 1.0)
            gain = 3600 * m * eff
            front = FRONT_MULT if life.peak_at_start >= 3 else 1.0
            life_rep += NODE_P0 * m * eff
            life_extra += NODE_P0 * m * eff * (front - 1 + FAME_SHARE)
            cap = need.get(realm)
            held = held + gain if cap is None else min(held + gain, cap)
            k += 1
            day = (k - 1) // STEPS_PER_DAY + 1
            while online and realm in need and held >= need[realm]:
                held -= need[realm]
                realm += 1
                if realm not in first:
                    first[realm] = day
                    reached.add(realm)
            age += age_rate(max([1, *reached])) * dt
            if age >= LIFESPAN[realm]:
                break
        life.end, life.age_end = k * dt, age
        extra += life_extra
        while qol and extra >= qol[0]:
            extra -= qol.pop(0)
        if not qol:
            wallet, extra = wallet + extra, 0.0
        wallet += shop_frac * life_rep
        while wallet >= NODE_P0 * (levels + 1):
            wallet -= NODE_P0 * (levels + 1)
            levels += 1
    return dict(first=first, lives=lives, levels_by_day=levels_by_day)


# ═══════════════════════════════════════════════════════════
# 求解 2：各境界所需与宿慧（逐个里程碑二分 + 外层不动点迭代）
#   NEED[X−1] 取「最晚第 d_X 天首达 X」的最大值；宿慧：首达 X 前手上的宿慧（境界 2..X−1）
#   = 声望阁乘区的 SUHUI_SHARE/(1−SUHUI_SHARE)。两者互相影响，反复求解直到稳定
# ═══════════════════════════════════════════════════════════

def solve() -> tuple[dict[int, float], dict[int, float]]:
    need: dict[int, float] = {}
    suhui: dict[int, float] = {x: 0.0 for x in range(2, 6)}
    for _ in range(8):
        prev = dict(need)
        for x in sorted(MILESTONE_DAY):
            lo, hi = 1.0, 1e12
            for _ in range(60):
                mid = (lo * hi) ** 0.5
                trial = {**{r: v for r, v in need.items() if r < x - 1}, x - 1: mid}
                got = play(trial, suhui, days=MILESTONE_DAY[x])["first"].get(x)
                if got is not None:
                    lo = mid
                else:
                    hi = mid
            need[x - 1] = lo
            if x - 1 >= 2:
                lv = play(need, suhui, days=MILESTONE_DAY[x])["levels_by_day"][MILESTONE_DAY[x]]
                suhui[x - 1] = SUHUI_SHARE / (1 - SUHUI_SHARE) * NODE_GAIN * lv - sum(suhui[r] for r in range(2, x - 1))
        if prev and all(abs(need[r] / prev[r] - 1) < 1e-4 for r in need):
            break
    return need, {x: round(v, 1) for x, v in suhui.items()}


NEED, SUHUI = solve()
BASE_TIME: dict[int, float] = {1: 0.0}      # 到达境界 X 所需的累计「M 加权有效秒」
for r in range(1, 6):
    BASE_TIME[r + 1] = BASE_TIME[r] + NEED[r]

REALM_TOTAL: dict[int, int] = {}           # 境界 r 的突破总额（分 N 段周天缴纳）
REALM_SPEND: dict[int, float] = {}         # 停留在境界 r 期间的全部内力开销 = 产出
for r in range(1, 6):
    REALM_SPEND[r] = (BASE_TIME[r + 1] - BASE_TIME[r]) * rate(r)
    # 产出 = 总额 × (1 + 冲穴附加) ÷ (1 − 武学份额)  ⇒  总额 = 产出 × (1 − 武学份额) ÷ (1 + 冲穴附加)
    REALM_TOTAL[r] = sig3(REALM_SPEND[r] * (1 - SKILL_SHARE) / (1 + CHONGXUE_OVERHEAD[r]))

# 标准玩家的推演结果（战斗侧 longline_sim 按这张「每一世」表逐世模拟）
STANDARD = play(NEED, SUHUI)
LIVES: list[Life] = STANDARD["lives"]


def quotas(realm: int) -> list[float]:
    """境界内各周天配额：等比数列，末段 = 该境界总额的一半（公比 2）"""
    n, total = ZHOUTIAN_N[realm], REALM_TOTAL[realm]
    q1 = total / ((QUOTA_RATIO ** n - 1) / (QUOTA_RATIO - 1))
    return [q1 * QUOTA_RATIO ** i for i in range(n)]


def life_at(t: float) -> Life:
    """时刻 t（天，从 0 起）活着的那一世"""
    for life in LIVES:
        if life.start <= t < life.end:
            return life
    return LIVES[-1]


def milestone_days(shop_frac: float = 1.0, daily: bool = False, days: int = 400) -> dict[int, int]:
    return play(NEED, SUHUI, shop_frac=shop_frac, daily=daily, days=days)["first"]


def main() -> None:
    w = 92
    print("═" * w)
    print(f"节奏求解器 · 输入：每天在线 {ONLINE_H}h + 离线 {24 - ONLINE_H}h（离线效率 {OFFLINE_EFF:.0%}）、"
          f"丹田封顶、只能在线突破、宿慧占比 {SUHUI_SHARE:.0%}、周天公比 {QUOTA_RATIO:.0f}")
    print(f"          内力去处：武学份额 {SKILL_SHARE:.0%}、冲穴附加 "
          + " / ".join(f"境界{r} {CHONGXUE_OVERHEAD[r]:.0%}" for r in range(1, 6)))
    print("═" * w)

    print("\n【表一】各境界内力总额与周天配额")
    print(f"{'境界':<4}{'N':>3}{'产出/秒':>9}{'本境界总额':>14}{'断崖':>7}{'基准时长':>10}"
          f"{'首段配额':>12}{'末段配额':>14}")
    print("-" * w)
    prev = None
    for r in range(1, 6):
        q = quotas(r)
        t = REALM_SPEND[r] / rate(r) / 3600          # 停留时长含冲穴与武学开销
        cliff = f"{REALM_TOTAL[r]/prev:.1f}×" if prev else "—"
        print(f"{r:<4}{ZHOUTIAN_N[r]:>3}{rate(r):>9.1f}{REALM_TOTAL[r]:>14,}{cliff:>7}"
              f"{t:>9.0f}h{q[0]:>12,.0f}{q[-1]:>14,.0f}")
        prev = REALM_TOTAL[r]

    first = STANDARD["first"]
    print("\n【表二】宿慧（首达境界的一次性永久产出加成）")
    print(f"{'首达境界':<10}{'宿慧':>10}{'达成日':>9}")
    print("-" * 30)
    for x in sorted(SUHUI):
        print(f"境界 {x:<7}{'+' + format(SUHUI[x], '.1f') + '×':>10}{'第' + str(first.get(x)) + '天':>9}")
    print("  （首达境界 6 的宿慧留待版本天花板上移时再解）")

    print("\n【表三】转世节奏：寿元与年岁速率")
    print(f"{'阶段':<8}{'目标世长':>8}{'寿元上限':>10}{'年岁速率':>12}{'实际世长':>18}{'世数':>6}")
    print("-" * 66)
    by_stage: dict[int, list[Life]] = {}
    for life in LIVES:
        if life.start < 100:
            by_stage.setdefault(life.peak_at_start, []).append(life)
    for p in range(1, 7):
        ls = by_stage.get(p, [])
        if not ls:
            continue
        spans = [life.end - life.start for life in ls]
        target = f"{LIFE_DAYS[p]:g} 天" if p in LIFE_DAYS else "—"
        print(f"境界 {p:<5}{target:>8}{LIFESPAN[p]:>9} 岁{age_rate(p):>8.1f} 年/天"
              f"{min(spans):>8.2f}–{max(spans):.2f} 天{len(ls):>6}")
    n100 = sum(1 for life in LIVES if life.start < 100)
    years = sum(age_rate(life.peak_at_start) * (min(life.end, 100) - life.start)
                for life in LIVES if life.start < 100)
    print(f"  前 100 天共转世 {n100} 次；江湖历约走 {years:,.0f} 年（按开世时的速率估）")

    print("\n【表四】声望阁：修行感悟的实际购买（归隐时用本世声望尽数买入）")
    print(f"  第 n 级 +{NODE_GAIN:.0%} 基础产出，价格 = {NODE_P0:.0f}P × n；基础声望 = {NODE_P0:.0f} × 乘区加权有效小时")
    print(f"  （声望 = 基础 × 前沿乘数 {FRONT_MULT}（首达境界 3 之后）+ 名号约 {FAME_SHARE:.0%}；多出基础的部分先买齐五件传承）")
    print(f"{'第d天':>7}{'累计级数':>10}{'声望阁乘区':>12}{'总乘区':>9}")
    print("-" * 40)
    for d in [2, 7, 21, 50, 100]:
        lv = STANDARD["levels_by_day"][d]
        life = life_at(d - 0.5)
        m = life.m_base + sum(SUHUI[x] for x, fd in first.items() if fd < d and x in SUHUI)
        print(f"{d:>7}{lv:>10}{NODE_GAIN * lv:>11.1f}×{m:>8.1f}×")

    print("\n【表五】验证 · 按天推演（一世可能跨几天，首达日允许早于目标不超过一世）")
    print(f"{'境界':<6}{'目标日':>8}{'实测日':>8}{'判定':>6}")
    print("-" * 30)
    ok = True
    for x in sorted(MILESTONE_DAY):
        got = first.get(x, -1)
        slack = LIFE_DAYS.get(x - 1, 1)
        hit = MILESTONE_DAY[x] - slack < got <= MILESTONE_DAY[x]
        ok &= hit
        print(f"境界 {x:<3}{MILESTONE_DAY[x]:>8}{got:>8}{'✓' if hit else '✗':>6}")
    print(f"\n  里程碑全部命中：{'是' if ok else '否'}")

    print("\n【表六】对照：同一套数值下，每次上线都归隐的玩家")
    daily = milestone_days(daily=True, days=400)
    for x in sorted(MILESTONE_DAY):
        d = daily.get(x)
        print(f"  境界 {x}：第 {d if d else '>400'} 天（标准玩家第 {first.get(x)} 天）")

    print("\n【附】首日体验（境界 1，无声望加成）")
    acc = 0.0
    for i, q in enumerate(quotas(1), 1):
        acc += q
        print(f"  第{i}周天 {q:>10,.0f} 内力 · 本段 {q/rate(1)/3600:>4.1f}h · 累计 {acc/rate(1)/3600:>4.1f}h")


if __name__ == "__main__":
    main()
