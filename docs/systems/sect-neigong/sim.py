#!/usr/bin/env python3
"""
门派 / 内功 / 武学 sim —— issue #36 第 2 步（设定 `design.md` v2.0，规格 `spec.md`）。

它回答的问题：
    1. 内功接替门径武学后，长线节奏与关卡是否原样成立？（寻常内功 = 现行「招式十成 + 火候」构筑）
    2. 装上武学后，三路数的核心机制是否变弱？（剑意积累 / 毒层积累 / 反伤的每回合速度 ≥ 只普攻的基线）
    3. 武学与内功品质带来的余量是否守住上限？（满配 ≤ ENVELOPE_CAP 个境界当量，远小于一档难度差）
    4. 余量有没有意义、三路数是否大体均衡、有没有唯一最优的武学？
    5. 熟练度、顿悟的等待时长是否落在目标里？

依赖方向：pacing_sim → longline_sim（每天的构筑与前沿）→ 本脚本。
golden 红线：只 import mvp0_sim / longline_sim，不改它们的任何函数；
    fight_x 在「EV 模式 + 不装武学」时必须与 mvp0_sim.fight 逐项一致（判据【零】）。

用法：python3 docs/systems/sect-neigong/sim.py
"""
from __future__ import annotations

import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sim"))
import mvp0_sim as m          # noqa: E402
import longline_sim as L      # noqa: E402

ROUTES = L.ROUTES             # huashan=惊雷 / tangmen=蚀骨 / shaolin=镇岳
ROUTE_NAME = {"huashan": "惊雷", "shaolin": "镇岳", "tangmen": "蚀骨"}
QUALITIES = ["寻常", "上乘", "绝学"]          # 神功本版不投放

# ═══════════════════════════════════════════════════════════
# 内功（spec §1）
# ═══════════════════════════════════════════════════════════

# 台阶：跨阶所需重数；前三阶即原门径三重参悟（机制节点 1/2/3），第四、五阶为高品质独有
TIER_AT = {"登堂": 2, "入室": 4, "大成": 6, "化境": 20, "归真": 40}
TIERS_OF = {"寻常": ["登堂", "入室", "大成"],
            "上乘": ["登堂", "入室", "大成", "化境"],
            "绝学": ["登堂", "入室", "大成", "化境", "归真"]}
HUOHOU_MULT = {"寻常": 1.00, "上乘": 1.02, "绝学": 1.04}   # 第 11 重起每重折合境界数的倍率
QI_COEF = {"寻常": 1.00, "上乘": 1.10, "绝学": 1.20}       # 真气上限系数


def neigong_build(route: str, realm: int, zhong: int, quality: str = "寻常") -> dict:
    """内功构筑。寻常 = 现行 longline_sim.build（第 1–10 重 = 原招式十成，第 11 重起 = 火候）"""
    passed = [t for t in TIERS_OF[quality] if zhong >= TIER_AT[t]]
    nodes = sum(1 for t in passed if t in ("登堂", "入室", "大成"))
    b = m.make_build(route, min(realm, 5), min(zhong, L.SHICHENG), nodes=nodes)
    dx = L.huohou_realms(zhong) * HUOHOU_MULT[quality]
    for key in ("hp", "atk", "dfs"):
        b[key] *= 1.7 ** dx
    b["hit"] += 12 * dx
    b["dodge"] += 3 * dx
    if realm >= 6:
        s5, s6 = L.REALM_STATS[5], L.REALM_STATS[6]
        for key in ("hp", "atk", "dfs"):
            b[key] *= s6[key] / s5[key]
        b["hit"], b["dodge"] = s6["hit"], s6["dodge"]
    # 第四阶「化境」：曾试原秘籍阁真传效果（剑意需求 −1、反伤 +15pp、每命中 +1 层毒），实测超出一档品质差，
    # 改为剑招倍率 +0.5、反伤 +5pp、毒伤系数 +3pp
    if "化境" in passed:
        if route == "huashan":
            b["burst_mult"] += 0.5
        elif route == "shaolin":
            b["thorns"] += 0.05
        else:
            b["poison"] = dict(b["poison"], coef=b["poison"]["coef"] + 0.03)
    # 第五阶「归真」（绝学独有）
    if "归真" in passed:
        if route == "huashan":
            b["cd"] += 0.20
        elif route == "shaolin":
            b["shield_pct"] += 0.08
        else:
            b["poison"] = dict(b["poison"], coef=b["poison"]["coef"] + 0.02)
    b["qi_max"] = qi_max(realm, zhong, quality)
    return b


def qi_max(realm: int, zhong: int, quality: str) -> float:
    """真气上限 = (70 + 15 × (境界 − 2) + 重数) × 品质系数"""
    return (70 + 15 * (max(realm, 2) - 2) + zhong) * QI_COEF[quality]


# ═══════════════════════════════════════════════════════════
# 武学（spec §2）
# ═══════════════════════════════════════════════════════════

WX = {   # 品质 → 招式数 / 耗气 / 冷却 / 第 1 式倍率 / 每式递增
    "寻常": dict(n=3, cost=25, cd=2, mult0=1.30),
    "上乘": dict(n=5, cost=40, cd=3, mult0=1.50),
    "绝学": dict(n=7, cost=55, cd=4, mult0=1.45),
}
MULT_STEP = 0.04          # 后一式比前一式倍率 +0.04
SHULIAN_STEP = 0.07       # 熟练每升一档（生疏 → 熟练 → 精通 → 圆熟）倍率 +7%
TRIGGER = 0.55            # 有候选时的出招率
REGEN = 20                # 普攻回气
RESONANCE_MULT = 1.10     # 与所修内功同路数：招式倍率 ×1.1（耗气打折实测无感：真气池够用，卡的是冷却与出招率）
DMG_SPREAD = 0.10         # 实战伤害 ±10%（combat.ts，PR #35）

# 招式特效（只用现有战斗里已有的效果，不新增状态）
#   必暴：本式必定暴击（惊雷借此攒剑意）
#   附毒：命中额外 +2 层毒（蚀骨叠毒更快；非蚀骨也能挂上毒，按 12% 系数、8 层上限、不毒爆）
#   护体：获得 8% 气血的护盾
#   回气：本式不耗气（等于白送一次出招）
EFFECTS = ("必暴", "附毒", "护体", "回气")
# 门派独门机制（每式都带，改变打法；对任何路数开放）：
#   蓄势（华山）：本场每出过一招，本式倍率 +10%
#   反震（少林）：本式按「攻击 + 防御」计伤
#   引爆（唐门）：立即结算敌人身上毒层 × 3 倍毒伤，然后清层
SIGNATURE = ("蓄势", "反震", "引爆")


def effect_forms(n: int) -> set[int]:
    """带特效的招式：第 1 式与末式（寻常 3 式里是第 1、3 式）"""
    return {1, n}


def skill(quality: str, tag: str, effect: str | None, unlocked: int | None = None, shulian: int = 3,
          name: str = "", signature: str | None = None) -> dict:
    """一门武学：已领悟 unlocked 式（缺省全部），每式熟练 shulian 档（0–3）。特效挂在第 1 式与末式上。"""
    p = WX[quality]
    n = p["n"] if unlocked is None else unlocked
    forms = []
    for k in range(1, n + 1):
        mult = (p["mult0"] + MULT_STEP * (k - 1)) * (1 + SHULIAN_STEP * shulian)
        eff = signature or (effect if (effect and k in effect_forms(p["n"])) else None)
        forms.append(dict(mult=mult, effect=eff))
    return dict(name=name or f"{quality}{tag}{effect or '直击'}", quality=quality, tag=tag,
                cost=p["cost"], cd=p["cd"], forms=forms)


# ═══════════════════════════════════════════════════════════
# 扩展战斗：mvp0_sim.fight + 真气 / 冷却 / 武学出招
# ═══════════════════════════════════════════════════════════

def fight_x(build: dict, enemy: dict, loadout=(), def_k=None, rng: random.Random | None = None,
            stats: dict | None = None):
    """rng=None 为 EV 模式（只支持不装武学，用于对照金标准）；否则为实战掷骰模式。
    stats 收集：rounds / bursts（剑招）/ pbursts（毒爆）/ thorns（反伤总量）/ casts（出招次数）/
    sq_gain（剑意积累）/ layer_gain（毒层积累）——机制频率按积累速度比，不按爆发次数（战斗变短时末轮没攒满会失真）"""
    ev = rng is None
    assert not (ev and loadout), "EV 模式不支持武学"
    roll = (lambda p: p) if ev else (lambda p: 1.0 if rng.random() < p else 0.0)
    spread = (lambda: 1.0) if ev else (lambda: 1 + DMG_SPREAD * (2 * rng.random() - 1))
    php = build["hp"]
    pshield = build["hp"] * build["shield_pct"]
    ehp = enemy["hp"]
    tags = enemy["tags"]
    is_boss = ("高血" in tags) or ("高防" in tags and "高攻" in tags)
    dmg_mult = 1.0
    sq = 0.0
    elayers = players_poison = ab_stacks = 0.0
    p_hit = m.hit_chance(build["hit"], enemy["dodge"])
    e_hit = m.hit_chance(enemy["hit"], build["dodge"])
    qmax = build.get("qi_max", 0)
    qi = qmax
    cds = [0] * len(loadout)
    pz = build["poison"]
    cap = pz["cap"] or 8                       # 非蚀骨被附毒：8 层上限
    coef = pz["coef"] or 0.12
    st = stats if stats is not None else {}
    for key in ("rounds", "bursts", "pbursts", "thorns", "casts", "sq_gain", "layer_gain"):
        st.setdefault(key, 0.0)

    st["_fight_casts"] = 0

    def done(win, rd):
        st["rounds"] += rd
        return win, rd, max(php, 0) / build["hp"]

    for rd in range(1, m.ROUND_CAP + 1):
        if rd == 1 and pz["init"]:
            elayers = min(cap, pz["init"])
        # ---- 玩家行动 ----
        forced = rd == 1 and build.get("first_crit")
        cand = [i for i, s in enumerate(loadout) if cds[i] == 0 and qi >= s["cost_eff"]]
        form = None
        if cand and roll(TRIGGER):
            i = rng.choice(cand)
            s = loadout[i]
            form = rng.choice(s["forms"])
            if form["effect"] != "回气":
                qi -= s["cost_eff"]
            cds[i] = s["cd"] + 1
            st["casts"] += 1
        for j in range(len(cds)):
            cds[j] = max(0, cds[j] - 1)
        mult = form["mult"] if form else 1.0
        eff = form["effect"] if form else None
        if eff == "蓄势":
            mult *= 1 + 0.10 * (st.get("_fight_casts", 0))
        if form:
            st["_fight_casts"] = st.get("_fight_casts", 0) + 1
        hit = roll(p_hit)
        if ev:
            crit_ev = build["cd"] if forced else (1 - build["crit"]) + build["crit"] * build["cd"]
            crit = 1.0 if forced else build["crit"]
        else:
            crit = 1.0 if (forced or eff == "必暴") else roll(build["crit"])
            crit_ev = build["cd"] if crit else 1.0
        # 蚀骨「普攻 ×0.60」只作用于普攻：轻手暗器说的是普攻，武学招式按全额
        plain = 1.0 if form else build.get("plain_mult", 1.0)
        base_atk = build["atk"] + (build["dfs"] if eff == "反震" else 0.0)
        dealt = base_atk * mult * crit_ev * m.mitig(enemy["dfs"], def_k) * hit * dmg_mult * plain * spread()
        if eff == "引爆" and elayers > 0:
            dealt += elayers * build["atk"] * coef * 3 * dmg_mult
            elayers = 0
        if not form:
            qi = min(qmax, qi + REGEN)
        if build["sq_need"] < 99:
            st["sq_gain"] += (p_hit * crit) if ev else (hit * crit)
            sq += (p_hit * crit) if ev else (hit * crit)
            if sq >= build["sq_need"]:
                sq -= build["sq_need"]
                dealt += build["atk"] * build["burst_mult"] * m.mitig(enemy["dfs"], def_k) * dmg_mult * spread()
                st["bursts"] += 1
        per_hit = pz["per_hit"] + (2 if eff == "附毒" else 0)
        if per_hit:
            st["layer_gain"] += (p_hit if ev else hit) * per_hit
            elayers = min(cap, elayers + (p_hit if ev else hit) * per_hit)
        if eff == "护体":
            pshield += 0.08 * build["hp"]
        ehp -= dealt
        if "反伤" in tags and dealt > 0:
            refl = dealt * m.THORNS_ENEMY
            absorb = min(pshield, refl); pshield -= absorb
            php -= (refl - absorb)
        if ehp <= 0:
            return done(True, rd)
        # ---- 敌人行动 ----
        eatk = enemy["atk"]
        if "狂暴" in tags and rd >= m.ENRAGE_START:
            eatk *= (1 + m.ENRAGE_STEP * (rd - m.ENRAGE_START + 1))
        ehit = roll(e_hit)
        pdfs = build["dfs"] * (1 - min(ab_stacks, 3) * m.ARMOR_BREAK_PP)
        edmg = eatk * ehit * m.mitig(pdfs, def_k) * spread()
        if build["lowhp_dr"] and php < 0.30 * build["hp"]:
            edmg *= (1 - build["lowhp_dr"])
        absorb = min(pshield, edmg); pshield -= absorb
        php -= (edmg - absorb)
        if build["thorns"] and edmg > 0:
            ehp -= edmg * build["thorns"]
            st["thorns"] += edmg * build["thorns"]
        if "破甲" in tags:
            ab_stacks = min(3, ab_stacks + ehit)
        if "毒" in tags:
            players_poison = min(5, players_poison + ehit)
        if ehp <= 0:
            return done(True, rd)
        # ---- 回合结束 ----
        if elayers > 0:
            ehp -= elayers * build["atk"] * coef * dmg_mult
            if pz["burst"] and elayers >= cap - 1e-9:
                ehp -= cap * build["atk"] * pz["burst"] * dmg_mult
                elayers = 0
                st["pbursts"] += 1
            if ehp <= 0:
                return done(True, rd)
        if players_poison > 0:
            php -= players_poison * enemy["atk"] * m.ENEMY_POISON_COEF
        if "净化" in tags and rd % m.PURIFY_EVERY == 0:
            elayers = 0
        if php <= 0:
            return done(False, rd)
    return done(False, m.ROUND_CAP)


def equip(build: dict, route: str, skills) -> list:
    """装配：同路数武学吃共鸣（招式倍率 ×RESONANCE_MULT）"""
    out = []
    for s in skills:
        k = RESONANCE_MULT if s["tag"] == route else 1.0
        out.append(dict(s, cost_eff=s["cost"], forms=[dict(f, mult=f["mult"] * k) for f in s["forms"]]))
    return out


N_TRIALS = 200


def winrate(build, x, loadout, tags=(), n=N_TRIALS, stats=None) -> float:
    e = L.enemy_at(x, tags)
    k = L.def_k(x)
    w = 0
    for i in range(n):
        w += fight_x(build, e, loadout, def_k=k, rng=random.Random(7919 * i + 13), stats=stats)[0]
    return w / n


GRID = 0.05
SPAN = (-1.0, 1.5)


def frontier_mc(build, loadout=(), tags=()) -> float:
    """期望前沿：胜率曲线下的面积（= 实战里「能打过的最强关」这一随机量的均值）。
    惊雷靠暴击、胜率曲线很平，「胜率 50% 的那一点」来回跳；面积对高方差路数更稳，也贴近可重试的推关。
    积分区间取 EV 前沿（不装武学的确定性前沿）−1.0 到 +1.5，下端胜率约为 1。"""
    x_ev = L.frontier_x(build, tags)
    x = x_ev + SPAN[0]
    area = x
    while x < x_ev + SPAN[1]:
        area += winrate(build, x + GRID / 2, loadout, tags) * GRID
        x += GRID
    return area


# ═══════════════════════════════════════════════════════════
# 检查点：各境界平台末（取 longline_sim 的标准玩家构筑）
# ═══════════════════════════════════════════════════════════

def checkpoints():
    S = L.solve()
    combat, plateaus = S["combat"], S["plateaus"]
    out = []
    for b, ds in sorted(plateaus.items()):
        d = ds[-1]
        realm, lv = combat[d]
        out.append((d, realm, lv))
    return out


# 各检查点「满配」可用的最高品质（spec §4 获取时间线）：境界 2 只有寻常；境界 3 起有上乘掉落、可拜门派换绝学
def best_quality(realm: int) -> str:
    return "寻常" if realm <= 2 else ("上乘" if realm == 3 else "绝学")


SLOTS = {2: 2, 3: 3, 4: 4, 5: 5, 6: 5}   # 装配槽跟境界走（spec §2.4）


def loadout_max(route: str, realm: int, effect_mix=("必暴", "附毒", "护体", "直击", "回气")) -> list:
    """满配：槽位装满、最高可用品质、全部招式领悟、熟练圆熟、全部同路数（共鸣）"""
    q = best_quality(realm)
    n = SLOTS[realm]
    effs = [e if e != "直击" else None for e in effect_mix][:n]
    return [skill(q, route, e) for e in effs]


def loadout_std(route: str, realm: int) -> list:
    """标准：槽位装满、低一档品质（境界 2 为寻常）、招式领悟一半、熟练「熟练」档、无共鸣"""
    q = {"寻常": "寻常", "上乘": "寻常", "绝学": "上乘"}[best_quality(realm)]
    n = SLOTS[realm]
    k = max(1, WX[q]["n"] // 2 + 1)
    effs = ["必暴", "附毒", "护体", None, "回气"][:n]
    other = {"huashan": "shaolin", "shaolin": "tangmen", "tangmen": "huashan"}[route]
    return [skill(q, other, e, unlocked=k, shulian=1) for e in effs]


ENVELOPE_CAP = 0.60       # 满配余量上限（境界当量）；一档难度差约 1.7–1.9
ENVELOPE_FLOOR = 0.10     # 标准配置余量下限：低于此，武学没有存在感
QUALITY_STEP_CAP = 0.20   # 内功每高一档品质，前沿差不超过此值（「一档品质差」）


def main():
    print("=" * 96)
    print("门派 / 内功 / 武学 sim —— issue #36 第 2 步")
    print("=" * 96)
    crit = []

    # 【零】金标准对照：寻常内功 = longline 构筑；EV 不装武学 = mvp0 fight
    ok0 = True
    for r in ROUTES:
        for realm, z in ((2, 6), (3, 41), (4, 70), (5, 95)):
            a, b = neigong_build(r, realm, z), L.build(r, realm, z)
            ok0 &= all(abs(a[k] - b[k]) < 1e-9 for k in ("hp", "atk", "dfs", "hit", "dodge", "crit", "cd"))
            for x in (realm + 1.0, realm + 3.0):
                e = L.enemy_at(x, ("狂暴",))
                ok0 &= fight_x(a, e, def_k=L.def_k(x))[:2] == m.fight(b, e, def_k=L.def_k(x))[:2]
    print(f"\n【零】金标准对照（寻常内功 = 现行构筑；EV 不装武学 = mvp0 fight）：{'一致' if ok0 else '不一致'}")
    crit.append(("寻常内功与现行构筑、金标准战斗逐项一致（关卡与节奏不用重调）", ok0, ""))

    cps = checkpoints()
    print("\n检查点（标准玩家各境界平台末）：" + " · ".join(f"第{d}天 境界{r} {lv}重" for d, r, lv in cps))

    # 【一】机制不劣化：装满武学 vs 只普攻，核心机制每回合频率
    print("\n【一】路数核心机制每回合频率（装满武学 / 只普攻）")
    ok1 = True
    for d, realm, lv in cps:
        q = best_quality(realm)
        for r in ROUTES:
            b = neigong_build(r, realm, lv, q)
            x = frontier_mc(b) - 0.3
            s0, s1 = {}, {}
            winrate(b, x, (), n=1000, stats=s0)          # 这一项看速度差几个百分点，样本加大压噪声
            winrate(b, x, equip(b, r, loadout_max(r, realm)), n=1000, stats=s1)
            key = {"huashan": "sq_gain", "tangmen": "layer_gain", "shaolin": "thorns"}[r]
            f0, f1 = s0[key] / s0["rounds"], s1[key] / s1["rounds"]
            ok = f1 >= f0 * 0.98
            ok1 &= ok
            unit = "反伤/回合" if r == "shaolin" else ("剑意/回合" if r == "huashan" else "毒层/回合")
            print(f"  境界{realm} {ROUTE_NAME[r]}：{unit} {f1:.3f} / {f0:.3f}  出招 {s1['casts'] / s1['rounds']:.2f}/回合"
                  f"  {'✓' if ok else '✗'}")
    crit.append(("装满武学后三路数核心机制频率不低于只普攻基线", ok1, ""))

    # 【二】余量：内功品质、标准武学、满配
    print("\n【二】余量（前沿较「寻常内功、不装武学」高出的境界当量）")
    print(f"  {'检查点':<12}{'路数':<5}{'上乘内功':>8}{'绝学内功':>8}{'标准武学':>8}{'满配':>8}{'满配无共鸣':>10}")
    ok_cap = ok_floor = ok_q = True
    env = {}
    for d, realm, lv in cps:
        for r in ROUTES:
            base_b = neigong_build(r, realm, lv)
            x0 = frontier_mc(base_b)
            dq = {}
            for q in ("上乘", "绝学"):
                dq[q] = frontier_mc(neigong_build(r, realm, lv, q)) - x0
            qb = best_quality(realm)
            bq = neigong_build(r, realm, lv, qb)
            d_std = frontier_mc(base_b, equip(base_b, r, loadout_std(r, realm))) - x0
            d_max = frontier_mc(bq, equip(bq, r, loadout_max(r, realm))) - x0
            no_res = [dict(s, tag="_") for s in loadout_max(r, realm)]
            d_nores = frontier_mc(bq, equip(bq, r, no_res)) - x0
            env[(realm, r)] = d_max
            ok_cap &= d_max <= ENVELOPE_CAP
            ok_floor &= d_std >= ENVELOPE_FLOOR
            ok_q &= dq["上乘"] <= QUALITY_STEP_CAP and dq["绝学"] - dq["上乘"] <= QUALITY_STEP_CAP
            print(f"  第{d:>3}天境界{realm} {ROUTE_NAME[r]:<4}{dq['上乘']:>+8.2f}{dq['绝学']:>+8.2f}"
                  f"{d_std:>+8.2f}{d_max:>+8.2f}{d_nores:>+10.2f}")
    crit.append((f"满配余量 ≤ {ENVELOPE_CAP} 境界当量（一档难度差约 1.7）", ok_cap, ""))
    crit.append((f"标准武学余量 ≥ {ENVELOPE_FLOOR}（武学有存在感）", ok_floor, ""))
    crit.append((f"内功每高一档品质 ≤ {QUALITY_STEP_CAP} 境界当量（一档品质差）", ok_q, ""))
    spread_ok = all(max(env[(rl, r)] for r in ROUTES) - min(env[(rl, r)] for r in ROUTES) <= 0.20
                    for rl in {k[0] for k in env})
    crit.append(("同一检查点三路数的满配余量相差 ≤ 0.20", spread_ok, ""))

    # 【三】无唯一最优：各路数单一特效的满配，谁最强
    print("\n【三】单一特效满配（境界 4 平台末），各路数最优特效")
    d, realm, lv = cps[2]
    tops = {}
    for r in ROUTES:
        bq = neigong_build(r, realm, lv, best_quality(realm))
        x0 = frontier_mc(neigong_build(r, realm, lv))
        res = {}
        for e in ("必暴", "附毒", "护体", "回气", None):
            lo = [skill(best_quality(realm), r, e) for _ in range(SLOTS[realm])]
            res[e or "直击"] = frontier_mc(bq, equip(bq, r, lo)) - x0
        best = max(res, key=res.get)
        tops[r] = best
        print(f"  {ROUTE_NAME[r]}：" + " · ".join(f"{k} {v:+.2f}" for k, v in res.items()) + f"  → {best}")
    ok3 = len(set(tops.values())) >= 2
    crit.append(("各路数的最优特效不全相同（无唯一最优武学）", ok3, str(tops)))

    # 【五】门派独门机制武学：换掉满配里的一门，余量仍守上限、且对三路数都有用
    print("\n【五】独门机制武学（换掉满配的末槽），余量")
    ok5 = True
    for d, realm, lv in cps[1:]:
        row = []
        for r in ROUTES:
            bq = neigong_build(r, realm, lv, best_quality(realm))
            x0 = frontier_mc(neigong_build(r, realm, lv))
            for sig, tag in zip(SIGNATURE, ("huashan", "shaolin", "tangmen")):
                lo = loadout_max(r, realm)[:-1] + [skill("绝学", tag, None, signature=sig)]
                dv = frontier_mc(bq, equip(bq, r, lo)) - x0
                ok5 &= dv <= ENVELOPE_CAP
                row.append(f"{ROUTE_NAME[r]}·{sig} {dv:+.2f}")
        print(f"  境界{realm}：" + " · ".join(row))
    crit.append((f"独门武学入满配后余量 ≤ {ENVELOPE_CAP}", ok5, ""))

    # 【四】熟练与顿悟的等待（按标准玩家每天 BATTLES_PER_DAY 场战斗）
    print("\n【四】熟练与顿悟的等待时长")
    ok4 = timing_report()
    crit.append(("熟练与顿悟等待落在目标区间", ok4, ""))

    print("\n----- 判据 -----")
    for label, ok, note in crit:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")
    return crit


# ═══════════════════════════════════════════════════════════
# 熟练度与顿悟（spec §2.2 / §3）
# ═══════════════════════════════════════════════════════════

BATTLES_PER_DAY = 40      # 标准玩家每天战斗场数（建模假设：推关 + 回刷，spec §7 说明）
SHULIAN_AT = {"寻常": (4, 10, 25), "上乘": (5, 12, 28), "绝学": (6, 15, 32)}   # 单式累计出招 → 熟练 / 精通 / 圆熟
SHULIAN_CARRY = 0.5       # 转世带入下一世的熟练比例
DUNWU_FORM_P = {"寻常": 0.25, "上乘": 0.08, "绝学": 0.05}   # 每出一次招的顿悟概率（悟性 1.0）
DUNWU_FORM_PAST = 3.0     # 前世领悟过的招式，顿悟概率 ×3
DUNWU_TIER_P = {"登堂": 0.5, "入室": 0.5, "大成": 0.5, "化境": 0.02, "归真": 0.01}  # 挂机每 10 分钟一判
WUXING_RANGE = (0.8, 1.2)


def timing_report() -> bool:
    # 每场出招数：取境界 4 标准装配在平台末、打略低于前沿的关（回刷 + 推关的平均）
    d, realm, lv = checkpoints()[2]
    r = "huashan"
    b = neigong_build(r, realm, lv, "上乘")
    lo = equip(b, r, loadout_std(r, realm))
    st = {}
    x = frontier_mc(b, lo) - 0.5
    winrate(b, x, lo, stats=st)
    casts_per_battle = st["casts"] / N_TRIALS
    per_skill_day = casts_per_battle * BATTLES_PER_DAY / SLOTS[realm]
    print(f"  每场出招 {casts_per_battle:.1f} 次 · 每天 {BATTLES_PER_DAY} 场 · 每门武学每天约出招 {per_skill_day:.0f} 次")
    ok = True
    for q in QUALITIES:
        forms_unlocked = WX[q]["n"]
        per_form_day = per_skill_day / max(1, forms_unlocked // 2 + 1)
        days = [t / per_form_day for t in SHULIAN_AT[q]]
        wait_new = 1 / DUNWU_FORM_P[q] / per_skill_day
        wait_past = 1 / (DUNWU_FORM_P[q] * DUNWU_FORM_PAST) / per_skill_day
        print(f"  {q}：单式熟练 / 精通 / 圆熟 约第 {days[0]:.1f} / {days[1]:.1f} / {days[2]:.1f} 天 · "
              f"新招顿悟约 {wait_new * 24:.1f} 小时（前世悟过 {wait_past * 24:.1f} 小时）")
        # 目标：寻常一两天圆熟、绝学一世（约 3–5 天）内圆熟；新招顿悟 ≤ 一天，前世悟过 ≤ 半天
        ok &= days[2] <= {"寻常": 2.5, "上乘": 4.0, "绝学": 6.0}[q]
        ok &= wait_new <= 1.0 and wait_past <= 0.5
    for t, p in DUNWU_TIER_P.items():
        lo_, hi_ = (1 / (p * WUXING_RANGE[1]) * 10, 1 / (p * WUXING_RANGE[0]) * 10)
        print(f"  内功台阶「{t}」顿悟期望等待（挂机）：{lo_ / 60:.1f}–{hi_ / 60:.1f} 小时（悟性 {WUXING_RANGE[1]}–{WUXING_RANGE[0]}）")
    ok &= 1 / (DUNWU_TIER_P["归真"] * WUXING_RANGE[0]) * 10 / 60 <= 24
    return ok


if __name__ == "__main__":
    main()
