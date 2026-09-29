#!/usr/bin/env python3
"""
长线战斗侧求解器 —— issue #22 第 2 步。

它回答的问题（`../pacing/design.md` §3.6–§3.8）：
    内力线由 pacing_sim 定好了（第 1/7/21/50/100 天首达境界 2–6）。
    在这个节奏下，玩家每天的战斗力怎么长、前沿推到哪、每条前沿几关、
    三档难度差多少、门径武学怎么计价、首通声望给多少，才能让前沿不冻结、武学不越档？

依赖方向（不可颠倒）：
    pacing_sim（境界总额、乘区、宿慧）
      → 每一世的内力流向：突破（含冲穴附加）+ 门径武学（份额 SKILL_SHARE）
        → 每天的峰值构筑（境界 + 武学等级）
          → 金标准 fight()（mvp0_sim，不改其任何函数）求出每天能打赢的最强敌人
            → 由这条「前沿曲线」反推关卡敌人、每档难度、Boss 门槛

多天一世（建模假设，报告须说明；2026-09-29 重开裁决 1）：
    每一世的起止时刻与开世乘区取自 pacing_sim.LIVES（活到寿终、自动归隐），本脚本逐世模拟内力流向。
    第 d 天能打的构筑 = 清晨活着的那一世此刻的构筑，当天寿终的那一世取寿终前的构筑，两者取强。
    每一世开头从境界 1 重爬，当天构筑会起伏；通关进度按「历来最强」计，关卡按这条单调的前沿铺。
    第 1 天用第一世在线 4 小时时的构筑。

golden 红线：只 import mvp0_sim 与 pacing_sim，不改它们的任何函数。
    本关防御常数经 fight(def_k=…) 传入（formulas.md §1.3 v1.6），缺省 100 保持旧 golden 不变。

产物回填：formulas.md §1.3 / §3.4 / §6.1、content.md §2.0、economy.md §1.3 / §4。

用法：python3 docs/systems/sim/longline_sim.py
"""
from __future__ import annotations
import math

import mvp0_sim as m
import pacing_sim as ps

# ═══════════════════════════════════════════════════════════
# 可调参数（标定对象）
# ═══════════════════════════════════════════════════════════

SKILL_SHARE = ps.SKILL_SHARE      # 标准玩家花在武学上的内力份额（与 pacing_sim 同一个数）

# 战力预算（门径武学大改前的临时替身，pacing/design.md §3.7、formulas.md §3.4）：
#   前 SHICHENG 级是「招式」，沿用各流派现行逐级效果；练满即「十成」。
#   之后每级是「火候」：三派一样，每级折合 1/LEVELS_PER_REALM 个境界——
#   气血/攻击/防御同乘 1.7^(1/N)、命中 +12/N、闪避 +3/N（与境界曲线同形）。
#   每级价格 = PRICE_0 × PRICE_Q^(n−1)，绝对内力计价、与境界无关；
#   等比计价 ⇒ 火候折合的境界数 ≈ log(武学累计内力) / (N·ln PRICE_Q)，天然递减。
SHICHENG = 10
LEVELS_PER_REALM = 20
PRICE_Q = 1.08
PRICE_0 = 3490                    # 5a 已实装（formulas.md §3.4）；原取境界 1 总额的 1%，境界 1 总额随多天一世重解后脱钩

STAGE_GAP = 0.05                  # 相邻两关的敌人差（境界当量）；0.05 ≈ 属性 +2.7%，等于 1 级火候
# 判据：任何一天起，最多连续这么多天推不出新关（全部前沿合计）。
#   多天一世后前沿只在每一世的末段才超过历来最强，后期一世 5 天、每天只强约 1%，
#   偶尔一整世没越过一个关距 ⇒ 上限放宽到两世（原「每天一世」时为 7 天）
MAX_STALL_DAYS = 2 * ps.LIFE_DAYS[5]
ELITE_EVERY = 4                   # 每条前沿每 4 关一个精英（有名号的对手），末尾是 Boss
ELITE_REP = 0.04                  # 首通精英：当天基础声望的这一比例（一次性）
BOSS_REP = 0.15                   # 首通 Boss：同上
MERIDIAN_REP = 0.50               # 首次贯通一条经脉：当天基础声望的这一比例（每境界 2 条，按首达下一境界当天计）
MERIDIANS_PER_REALM = 2
ONE_TIME_CAP = 0.10               # 判据：一次性声望（首通 + 成就）≤ 累计基础声望的一成
SHOP_FRACS = (1.0, 0.5, 0.0)      # 判据：声望阁只买标准量的这些比例时，里程碑晚多少
POGUAN_BONUS = 0.10               # 声望阁「破关心得」：对 Boss 伤害 +10%（economy.md §4）
POGUAN_DAY = 12                   # 按 QoL 定价，标准玩家约第 12 天前买齐

ROUTES = ["huashan", "tangmen", "shaolin"]
ONLINE_H = ps.ONLINE_H            # 标准玩家每天在线小时（pacing_sim 画像）

# 境界 6 属性（content.md §1；mvp0_sim 只到 5）
REALM_STATS = dict(m.REALMS)
REALM_STATS[6] = dict(hp=1680, atk=168, dfs=88, hit=160, dodge=25, cost=0)

# ═══════════════════════════════════════════════════════════
# 敌人：用「境界当量 x」参数化——x 每 +1，气血/攻击/防御 ×1.7、命中 +12、闪避 +3，
# 与玩家境界曲线同形（formulas.md §3.1）。模板取现行普通关的量级。
# ═══════════════════════════════════════════════════════════

ENEMY_BASE = dict(hp=60.0, atk=6.0, dfs=3.5, hit=100.0, dodge=8.0)


# 属性类标签的修正（content.md §2.0）：这四个标签不在 fight() 里生效，而是改敌人属性；
# 反伤 / 毒 / 净化 / 破甲 / 狂暴 由 fight() 结算，不改属性。
TAG_MODS = {
    "高闪": dict(dodge=3.0),
    "高血": dict(hp=2.0),
    "高防": dict(dfs=1.6),
    "高攻": dict(atk=1.4),
}


def enemy_at(x: float, tags: tuple[str, ...] = ()) -> dict:
    k = 1.7 ** (x - 1)
    e = dict(hp=ENEMY_BASE["hp"] * k, atk=ENEMY_BASE["atk"] * k, dfs=ENEMY_BASE["dfs"] * k,
             hit=ENEMY_BASE["hit"] + 12 * (x - 1), dodge=ENEMY_BASE["dodge"] + 3 * (x - 1),
             tags=list(tags))
    for t in tags:
        for key, mult in TAG_MODS.get(t, {}).items():
            e[key] *= mult
    return e


# ═══════════════════════════════════════════════════════════
# 门径武学：计价与递减
# ═══════════════════════════════════════════════════════════

def skill_cost(level: int) -> float:
    """买第 level 级的内力价"""
    return PRICE_0 * PRICE_Q ** (level - 1)


def huohou_realms(level: int) -> float:
    """火候折合的境界数"""
    return max(0, level - SHICHENG) / LEVELS_PER_REALM


def build(route: str, realm: int, level: int) -> dict:
    b = m.make_build(route, min(realm, 5), min(level, SHICHENG), nodes=3)
    dx = huohou_realms(level)
    for key in ("hp", "atk", "dfs"):
        b[key] *= 1.7 ** dx
    b["hit"] += 12 * dx
    b["dodge"] += 3 * dx
    if realm >= 6:   # make_build 只认境界 1–5：按境界 6 属性等比放大
        s5, s6 = REALM_STATS[5], REALM_STATS[6]
        for key in ("hp", "atk", "dfs"):
            b[key] *= s6[key] / s5[key]
        b["hit"], b["dodge"] = s6["hit"], s6["dodge"]
    return b


# 防御常数随关卡强度放大（formulas.md §1.3 v1.6）：
# K 固定为 100 时，敌我防御涨到 K 的数倍后减伤饱和、伤害不再随攻击同比增长，
# 后期战斗越打越长、撞 50 回合上限（少林最先）。K 与属性同曲线放大即可保持各档手感一致。
DEF_K_SCALED = True


def def_k(x: float) -> float:
    return m.DEF_K if not DEF_K_SCALED else 100 * 1.7 ** max(0.0, x - 3)


def win_at(b: dict, x: float, tags: tuple[str, ...] = ()) -> bool:
    return m.fight(b, enemy_at(x, tags), def_k=def_k(x))[0]


def frontier_x(b: dict, tags: tuple[str, ...] = ()) -> float:
    """这套构筑能打赢的最强敌人的境界当量（二分）"""
    lo, hi = 0.0, 40.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if win_at(b, mid, tags):
            lo = mid
        else:
            hi = mid
    return lo


# ═══════════════════════════════════════════════════════════
# 一世：按有效小时推进内力流向
# ═══════════════════════════════════════════════════════════

def run_lives(days: int = 115):
    """按 pacing_sim 推演出的每一世（起止时刻、开世乘区）逐世模拟内力流向，规则同 pacing_sim.play：
    每天前 ONLINE_H 小时在线；丹田满（本境界突破所需）后多出的产出散掉；突破与买武学只在线做。
    首达境界即时记入宿慧。返回 (每天的战斗构筑, 首达日)。

    第 d 天的战斗构筑：当天在线时段结束时活着那一世的构筑；若有一世在当天上线时寿终，
    玩家先用它推前沿再归隐，取两者中更强的。"""
    reached: set[int] = set()
    first_day: dict[int, int] = {}
    runs = []                                  # (一世, [(时刻, 境界, 等级)])
    step = 1 / 24 / 4                          # 15 分钟（天）
    for life in ps.LIVES:
        if life.start >= days:
            break
        realm, level = 1, 0
        realm_wallet = skill_wallet = 0.0
        n = round((life.end - life.start) / step)
        snaps = [(life.start, 1, 0)]
        for i in range(n):
            t = life.start + i * step
            online = (t - math.floor(t + 1e-9)) * 24 < ONLINE_H - 1e-9
            mult = life.m_base + sum(ps.SUHUI.get(x, 0.0) for x in reached)
            flow = ps.rate(min(realm, 5)) * mult * 3600 * 24 * step * (1.0 if online else ps.OFFLINE_EFF)
            need = ps.REALM_TOTAL[realm] * (1 + ps.CHONGXUE_OVERHEAD[realm]) if realm <= 5 else None
            if need is not None and not online and realm_wallet >= need:
                flow = 0.0                     # 丹田已满：离线产出散掉
            realm_wallet += flow * (1 - SKILL_SHARE)
            skill_wallet += flow * SKILL_SHARE
            if online:
                while realm <= 5 and realm_wallet >= ps.REALM_TOTAL[realm] * (1 + ps.CHONGXUE_OVERHEAD[realm]):
                    realm_wallet -= ps.REALM_TOTAL[realm] * (1 + ps.CHONGXUE_OVERHEAD[realm])
                    realm += 1
                    if realm not in first_day:
                        first_day[realm] = math.floor(t + 1e-9) + 1
                        reached.add(realm)
                while skill_wallet >= skill_cost(level + 1):
                    skill_wallet -= skill_cost(level + 1)
                    level += 1
            snaps.append((t + step, realm, level))
        # 最后一次上线：先突破、买武学，再归隐
        while realm <= 5 and realm_wallet >= ps.REALM_TOTAL[realm] * (1 + ps.CHONGXUE_OVERHEAD[realm]):
            realm_wallet -= ps.REALM_TOTAL[realm] * (1 + ps.CHONGXUE_OVERHEAD[realm])
            realm += 1
            if realm not in first_day:
                first_day[realm] = math.floor(life.end + 1e-9) + 1
                reached.add(realm)
        while skill_wallet >= skill_cost(level + 1):
            skill_wallet -= skill_cost(level + 1)
            level += 1
        snaps.append((life.end, realm, level))
        runs.append((life, snaps))

    def state_at(snaps, t):
        best = snaps[0]
        for sn in snaps:
            if sn[0] <= t + 1e-9:
                best = sn
            else:
                break
        return best[1:]

    # 开局构筑：第一世突破到境界 2 之前的最后一刻（新玩家第一关要从这里铺起）
    opening = [sn for sn in runs[0][1] if sn[1] == 1][-1][1:]
    combat = {}
    for d in range(1, days + 1):
        t_on, t_off = d - 1, d - 1 + ONLINE_H / 24
        cands = []
        for life, snaps in runs:
            if abs(life.end - t_on) < 1e-6:
                cands.append(snaps[-1][1:])                    # 上线时寿终的那一世
            elif life.start <= t_on < life.end:
                cands.append(state_at(snaps, min(t_off, life.end)))
        combat[d] = max(cands) if cands else combat[d - 1]
    return combat, first_day, opening


# ═══════════════════════════════════════════════════════════
# 前沿曲线 → 关卡
# ═══════════════════════════════════════════════════════════

# 各段（战斗时的境界）对应的前沿：（图, 难度） —— pacing/design.md §3.3
TRACKS = {
    1: [(1, "普通")],
    2: [(1, "普通")],                              # 第 1–6 天（第 1 天为境界 1，并入本段）
    3: [(2, "普通"), (1, "困难")],
    4: [(3, "普通"), (2, "困难"), (1, "噩梦")],
    5: [(4, "普通"), (3, "困难"), (2, "噩梦")],
}
TIER_INDEX = {"普通": 0, "困难": 1, "噩梦": 2}


def band_of(realm: int) -> int:
    return realm


def boss_threshold(combat: dict, d: int) -> float:
    """Boss 门槛 = 下一境界首日最慢路线刚好打得过；买了破关心得的日子按伤害 +10% 算。
    境界 5 段的 Boss 需境界 6：按「入境界 6、武学仍是第 100 天的等级」计（本版收官）"""
    realm, lv = combat[d] if d <= 100 else (6, combat[100][1])
    k = 1 + POGUAN_BONUS if d >= POGUAN_DAY else 1.0
    xs = []
    for r in ROUTES:
        bd = build(r, realm, lv)
        bd["atk"] *= k
        xs.append(frontier_x(bd))
    return min(xs)


def solve() -> dict:
    """前沿曲线与各前沿的起点 / 终点 / Boss 门槛（main 打印与关卡表导出共用，防两处口径漂移）"""
    raw, first_day, opening = run_lives()
    # 一世跨多天：每一世开头从境界 1 重爬，当天构筑会起伏。通关进度按「历来最强」计——
    # 第 d 天的前沿 = 第 1..d 天里最慢路线前沿最高的那天的构筑（它决定玩家推到过哪）
    raw_x = {d: min(frontier_x(build(r, *raw[d])) for r in ROUTES) for d in sorted(raw)}
    combat, best = {}, None
    for d in sorted(raw):
        if best is None or raw_x[d] > raw_x[best]:
            best = d
        combat[d] = raw[best]
    days = [d for d in sorted(combat) if d <= 100 and combat[d][0] <= 5]   # 本版止于首达境界 6
    X = {r: {d: frontier_x(build(r, *combat[d])) for d in days} for r in ROUTES}
    x_min = {d: min(X[r][d] for r in ROUTES) for d in days}   # 最慢路线定关卡，保证三路线都推得动
    plateaus: dict[int, list[int]] = {}
    for d in days:
        plateaus.setdefault(band_of(combat[d][0]), []).append(d)
    tracks = {}     # (图, 难度, 段) → (起点 x, 段末 x, Boss x)
    x_open = min(frontier_x(build(r, *opening)) for r in ROUTES)
    for b, ds in sorted(plateaus.items()):
        nxt = ds[-1] + 1
        for (mp, tier) in TRACKS[b]:
            # 新前沿从解锁当天刚好打得过的位置起铺：突破那一跳由上一段的 Boss 承接，不白送一串关。
            # 第一条前沿从开局构筑（第一世境界 1 末）铺起——第一天在线结束时已入境界 2
            x0 = x_open if (mp, tier) == (1, "普通") and b == min(plateaus) else x_min[ds[0]]
            tracks[(mp, tier, b)] = (x0, x_min[ds[-1]], boss_threshold(combat, nxt))
    return dict(combat=combat, first_day=first_day, days=days, X=X, x_min=x_min,
                plateaus=plateaus, tracks=tracks)


def main():
    S = solve()
    combat, first_day, days, X, x_min = S["combat"], S["first_day"], S["days"], S["X"], S["x_min"]

    print("=" * 96)
    print("长线战斗侧求解器 —— issue #22 第 2 步（判据见 pacing/design.md §3.6）")
    print("=" * 96)
    print(f"参数：武学份额 {SKILL_SHARE:.0%} · 第 n 级价 = {PRICE_0:,.0f} × {PRICE_Q:.4f}^(n−1) · "
          f"十成后每 {LEVELS_PER_REALM} 级火候折合 1 境界 · 关距 {STAGE_GAP} 境界")

    # ── 里程碑（含冲穴与武学开销后是否仍命中）
    print("\n【一】里程碑：扣除冲穴附加与武学份额后的实际首达日")
    ok_mile = True
    for x, target in ps.MILESTONE_DAY.items():
        got = first_day.get(x)
        hit = got is not None and abs(got - target) <= max(1, 0.15 * target)
        ok_mile &= hit
        print(f"  境界 {x}：目标第 {target:>3} 天 · 实际第 {got if got else '—':>3} 天 {'✓' if hit else '✗'}")

    # ── 每日构筑与前沿
    print("\n【二】每日战斗构筑与前沿（境界当量；日增为最慢路线较前一天）")
    print(f"  {'天':>4} {'境界':>4} {'武学':>5} {'火候':>6} " + " ".join(f"{r:>9}" for r in ROUTES) + f" {'最慢':>7} {'日增':>6}")
    prev = None
    for d in days:
        r, lv = combat[d]
        if d in (1, 2, 3, 6, 7, 8, 14, 20, 21, 22, 35, 49, 50, 51, 75, 99, 100):
            inc = "" if prev is None else f"{x_min[d] - x_min[d-1]:+.3f}"
            print(f"  {d:>4} {r:>4} {lv:>5} {huohou_realms(lv):>6.2f} "
                  + " ".join(f"{X[rt][d]:>9.3f}" for rt in ROUTES) + f" {x_min[d]:>7.3f} {inc:>6}")
        prev = d

    # ── 武学在一个境界平台期内的增长 < 一个境界（余量给更高难度与主动武学）
    print("\n【三】各平台期内的前沿增长（平台末须低于下一境界首日，否则武学越档）")
    ok_gap = True
    plateaus = S["plateaus"]
    for b, ds in sorted(plateaus.items()):
        grow = x_min[ds[-1]] - x_min[ds[0]]
        jump = (x_min[ds[-1] + 1] - x_min[ds[-1]]) if ds[-1] + 1 in x_min else float("nan")
        # 越档 = 平台末的前沿追上下一境界首日。多天一世后平台首日常是刚突破、武学还没跟上的一世，
        # 「平台内增长 < 1 境界」这个近似会误报，改为直接比较（最后一段看收官 Boss）
        ok = math.isnan(jump) or jump > 0
        ok_gap &= ok
        print(f"  境界 {b} 平台 第{ds[0]:>3}–{ds[-1]:>3} 天：平台内增长 {grow:+.3f}"
              f"{'' if math.isnan(jump) else f' · 突破当天跳 {jump:+.3f}'} {'✓' if ok else '✗'}")

    # ── 关卡：同一前沿相邻两关差 STAGE_GAP；前沿从本段首日能打到的位置铺到下一境界首日（Boss）
    print(f"\n【四】关卡与难度（关距 {STAGE_GAP} 境界 ≈ 属性 +{1.7 ** STAGE_GAP - 1:.1%}）")
    tracks = {k: (v[0], v[2]) for k, v in S["tracks"].items()}   # (图, 难度, 段) → (起点 x, Boss x)
    for (mp, tier, b), (x0, xb) in tracks.items():
        ds = plateaus[b]
        top = x_min[ds[-1]]
        n = max(0, math.floor((top - x0) / STAGE_GAP))
        boss = f"Boss x {xb:.2f}（下一境界首日可过）" if b < 5 else f"Boss x {xb:.2f}（需境界 6，本版收官）"
        print(f"  图{mp} {tier:<2}（境界 {b} 段，第{ds[0]:>3}–{ds[-1]:>3} 天）：x {x0:.2f}→{top:.2f} · 约 {n:>2} 关 · {boss}")

    print("\n  相邻难度的敌人强度比（同一张图，两档起点之差）：")
    starts = {}
    for (mp, tier, b), (x0, _) in tracks.items():
        starts[(mp, tier)] = min(x0, starts.get((mp, tier), x0))
    for mp in (1, 2, 3):
        tiers = [t for t in ("普通", "困难", "噩梦") if (mp, t) in starts]
        for a_, c in zip(tiers, tiers[1:]):
            dx = starts[(mp, c)] - starts[(mp, a_)]
            print(f"    图{mp} {a_}→{c}：Δx {dx:+.2f} ≈ 属性 ×{1.7 ** dx:.2f}")

    # ── 每天推出的新关（全部前沿合计）：前沿每越过一个关距算一关
    print("\n【五】每天推出的新关（最慢路线，全部前沿合计）")
    cleared = {d: math.floor(x_min[d] / STAGE_GAP) for d in days}
    live = {d: len(TRACKS[band_of(combat[d][0])]) for d in days}
    new = {d: (0 if band_of(combat[d][0]) != band_of(combat[d - 1][0]) else
               max(0, cleared[d] - cleared[d - 1]) * live[d]) for d in days[1:]}
    stall, longest, longest_at = 0, 0, 0
    for d in days[1:]:
        stall = 0 if new[d] else stall + 1
        if stall > longest:
            longest, longest_at = stall, d
    for b, ds in sorted(plateaus.items()):
        seg = [new[d] for d in ds if d in new]
        if not seg:
            continue
        moving = sum(1 for v in seg if v)
        print(f"  境界 {b} 段 第{ds[0]:>3}–{ds[-1]:>3} 天：{len(TRACKS[b])} 条前沿 · 共 {sum(seg):>3} 关 · "
              f"有新关的天数 {moving}/{len(seg)}")
    print(f"  最长连续无新关：{longest} 天（截至第 {longest_at} 天）")

    # ── 首通声望：只有精英与 Boss 给（pacing/design.md §3.5）
    print(f"\n【六】首通声望（每 {ELITE_EVERY} 关一个精英 +当天基础声望 {ELITE_REP:.0%}，Boss +{BOSS_REP:.0%}）")
    reached_live: set[int] = set()
    base = {}
    for d in range(1, 101):
        reached_live |= {x for x, fd_ in first_day.items() if fd_ < d}
        base[d] = ps.NODE_P0 * ps.E_HOURS * (ps.life_at(d - 0.5).m_base
                                             + sum(ps.SUHUI.get(x, 0.0) for x in reached_live))
    elite_n = boss_n = 0
    one_time = 0.0
    events = []
    for (mp, tier, b), (x0, xb) in tracks.items():
        ds = plateaus[b]
        t_idx = TRACKS[b].index((mp, tier))
        stagger = t_idx * ELITE_EVERY // len(TRACKS[b])   # 同段各前沿的精英错开，不挤在同一天
        i0 = math.floor(x0 / STAGE_GAP) - stagger
        prev = i0
        for d in ds:
            cur = math.floor(x_min[d] / STAGE_GAP)
            for k in range(prev + 1, cur + 1):
                if (k - i0) % ELITE_EVERY == 0:
                    elite_n += 1; one_time += ELITE_REP * base[d]; events.append(d)
            prev = max(prev, cur)
        nxt = ds[-1] + 1
        if nxt <= 100:
            boss_n += 1; one_time += BOSS_REP * base[nxt]; events.append(nxt)
    meridian = 0.0
    for r in range(1, 6):
        d = first_day.get(r + 1)
        if d and d <= 100:
            meridian += MERIDIANS_PER_REALM * MERIDIAN_REP * base[d]
    cum_base = sum(base.values())
    gaps = [b_ - a_ for a_, b_ in zip(sorted(set(events)), sorted(set(events))[1:])]
    print(f"  100 天内：精英 {elite_n} 个 · Boss {boss_n} 个 · 有首通声望的天数 {len(set(events))} · "
          f"最长间隔 {max(gaps)} 天")
    print(f"  首通声望合计 {one_time:,.0f} = 累计基础声望 {cum_base:,.0f} 的 {one_time / cum_base:.1%}")
    print(f"  经脉贯通成就（每条 +当天基础声望 {MERIDIAN_REP:.0%}）合计 {meridian:,.0f} = {meridian / cum_base:.1%}")
    total_share = (one_time + meridian) / cum_base
    print(f"  一次性声望合计 {total_share:.1%}（上限 {ONE_TIME_CAP:.0%}，余量留给以后新增的成就）")
    first_clear_ok = total_share <= ONE_TIME_CAP

    # ── 托底：声望阁买少了，里程碑晚多少（宿慧不经声望，照发）
    print("\n【七】托底：声望阁只买标准量的一部分时，首达日")
    drift = {}
    for frac in SHOP_FRACS:
        fd = milestone_days(frac)
        drift[frac] = fd
        print(f"  买 {frac:>4.0%}：" + " · ".join(
            f"境界{x} 第{fd.get(x, '—')}天" for x in sorted(ps.MILESTONE_DAY)))

    # ── 判据汇总
    print("\n----- 判据 -----")
    crit = [
        ("里程碑不漂（扣开销后首达日 ±15%）", ok_mile, ""),
        ("武学不能越档（平台末前沿 < 下一境界首日前沿）", ok_gap, ""),
        (f"最长连续无新关 ≤ {MAX_STALL_DAYS} 天", longest <= MAX_STALL_DAYS, f"实际 {longest} 天"),
        ("首达境界 3 两天后同时 ≥2 条前沿", all(live[d] >= 2 for d in days if d >= first_day[3] + 2), ""),
        (f"一次性声望（首通 + 成就）≤ 累计基础声望 {ONE_TIME_CAP:.0%}", first_clear_ok, ""),
    ]
    for label, ok, note in crit:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")
    return crit


def milestone_days(shop_frac: float, days: int = 400) -> dict[int, int]:
    """声望阁只买标准量 shop_frac 时的首达日（同 pacing_sim.play 的口径）"""
    return ps.milestone_days(shop_frac, days=days)


if __name__ == "__main__":
    main()
