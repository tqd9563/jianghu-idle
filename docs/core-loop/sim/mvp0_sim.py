#!/usr/bin/env python3
"""MVP-0 首轮推进曲线自洽校验模拟器。

校验《MVP-0 公式表》《MVP-0 内容表》的数值链是否闭合——玩家按贪心策略
推进时，节拍是否命中规格书 v0.4 锁定的锚点：
  - 境界 2（构筑选择）5–8 分钟
  - Boss 1 击杀 12–18 分钟
  - Boss 2 首次到达即失败（硬卡点），调整后 25–35 分钟击杀
  - Boss 3 + 境界 5 于 45–60 分钟达成
  - 第二轮（2 个声望节点）到 Boss 2 击杀提速 25%–40%
  - 相邻可见进展（关卡/升级/突破/Boss）间隔 ≤ 5 分钟
战斗采用期望值（EV）确定性回合模拟，经济采用贪心升级策略。
运行：python3 mvp0_sim.py
"""

# ============================================================
# 公式表参数（与 mvp-0-formula-tables.md 保持一致）
# ============================================================

DEF_K = 100              # 防御双曲常数：减伤系数 = K / (K + DEF)
HIT_FLOOR = 0.30         # 命中率下限
BATTLE_OVERHEAD_S = 25   # 单次战斗（演出+操作）耗时秒
ROUND_CAP = 50           # 战斗回合上限（超时判负）
IDLE_NEILI_BASE = 9.0    # 境界 1 挂机内力产出/秒
IDLE_REALM_MULT = 1.25   # 每境界挂机产出倍率（修炼效率随境界提升）

def idle_rate(realm, neili_mult=1.0):
    return IDLE_NEILI_BASE * IDLE_REALM_MULT ** (realm - 1) * neili_mult

# 境界表：HP/ATK/DEF ×1.7 每境界；命中 +12；闪避 +3
REALMS = {
    1: dict(hp=100, atk=10, dfs=5,  hit=100, dodge=10, cost=0),
    2: dict(hp=170, atk=17, dfs=9,  hit=112, dodge=13, cost=2800),
    3: dict(hp=290, atk=29, dfs=15, hit=124, dodge=16, cost=5000),
    4: dict(hp=495, atk=49, dfs=26, hit=136, dodge=19, cost=10000),
    5: dict(hp=840, atk=84, dfs=44, hit=148, dodge=22, cost=21000),
}
BASE_CRIT = 0.05
BASE_CD = 1.50
SKILL_LV_CAP_PER_REALM = 2   # 武学等级上限 = 境界 × 2

def skill_cost(n):           # 武学等级 n 的内力消耗
    return round(200 * 1.4 ** (n - 1))

ROUTES = {
    "huashan": dict(
        grant=dict(crit=0.10, cd=0.20),
        per_lv=dict(atk_pct=0.04, crit=0.025, cd=0.08),
        sword_qi_need=5, burst_mult=4.0,
    ),
    "shaolin": dict(
        grant=dict(shield_pct=0.30, thorns=0.25, def_pct=0.20),
        per_lv=dict(hp_pct=0.06, def_pct=0.06, thorns=0.03),
    ),
    "tangmen": dict(
        grant=dict(poison_init=2, poison_per_hit=1, poison_coef=0.12,
                   poison_cap=8, burst_coef=0.5),
        per_lv=dict(atk_pct=0.03, poison_coef=0.015),
    ),
}

MECH_NODE_COST = [40, 80, 150]   # 机制节点阅历价格
ROUTE_SWITCH_SILVER = 200        # 换路线银两摩擦成本（阅历 100% 返还）

# 敌人标签参数
ENRAGE_START = 13
ENRAGE_STEP = 0.08
PURIFY_EVERY = 3
THORNS_ENEMY = 0.30
ARMOR_BREAK_PP = 0.15
ENEMY_POISON_COEF = 0.08

# ============================================================
# 内容表参数（与 mvp-0-content-tables.md 保持一致）
# ============================================================

def build_stages():
    stages = []
    # 地图 1：村外小径，8 关（Boss@8）
    for i in range(1, 9):
        e = dict(hp=round(25 * 1.28 ** (i - 1)), atk=round(4 * 1.17 ** (i - 1), 1),
                 dfs=round(2 * 1.15 ** (i - 1), 1), hit=90 + 2 * i, dodge=8, tags=[])
        r = dict(neili=60, silver=10, yueli=3)
        if i == 8:  # Boss 1 山贼头目：基础高血量
            e = dict(hp=550, atk=15, dfs=10, hit=112, dodge=8, tags=["高血"])
            r = dict(neili=250, silver=60, yueli=30)
        stages.append(("map1", i, e, r))
    # 地图 2：洛阳近郊，10 关，精英@4(高闪)、@7(破甲)，Boss@10
    for i in range(1, 11):
        e = dict(hp=round(115 * 1.15 ** (i - 1)), atk=round(11 * 1.10 ** (i - 1), 1),
                 dfs=round(9 * 1.12 ** (i - 1), 1), hit=105 + 2 * i, dodge=12, tags=[])
        r = dict(neili=150, silver=20, yueli=5)
        if i == 4:
            e["tags"] = ["高闪"]; e["dodge"] = 50; e["hp"] = round(e["hp"] * 1.4)
            r = dict(neili=300, silver=40, yueli=10)
        if i == 7:
            e["tags"] = ["破甲"]; e["hp"] = round(e["hp"] * 1.4)
            r = dict(neili=300, silver=40, yueli=10)
        if i == 10:  # Boss 2 铁掌恶僧：高防 + 高攻（首个硬瓶颈）
            e = dict(hp=950, atk=34, dfs=55, hit=132, dodge=14, tags=["高防", "高攻"])
            r = dict(neili=800, silver=120, yueli=50)
        stages.append(("map2", i, e, r))
    # 地图 3：华山古道，10 关，精英@3(反伤)、@5(毒)、@7(净化)，Boss@10
    for i in range(1, 11):
        e = dict(hp=round(340 * 1.14 ** (i - 1)), atk=round(24 * 1.07 ** (i - 1), 1),
                 dfs=round(20 * 1.10 ** (i - 1), 1), hit=130 + 2 * i, dodge=16, tags=[])
        r = dict(neili=300, silver=30, yueli=8)
        if i == 3:
            e["tags"] = ["反伤"]; e["hp"] = round(e["hp"] * 1.4)
            r = dict(neili=500, silver=60, yueli=15)
        if i == 5:
            e["tags"] = ["毒"]; e["hp"] = round(e["hp"] * 1.3)
            r = dict(neili=500, silver=60, yueli=15)
        if i == 7:
            e["tags"] = ["净化"]; e["hp"] = round(e["hp"] * 1.4)
            r = dict(neili=500, silver=60, yueli=15)
        if i == 10:  # Boss 3 黑风寨主：纯数值检查（高血 + 温和狂暴）
            e = dict(hp=2500, atk=46, dfs=35, hit=152, dodge=18,
                     tags=["高血", "狂暴"])
            r = dict(neili=1500, silver=200, yueli=80)
        stages.append(("map3", i, e, r))
    return stages

# ============================================================
# 构筑与战斗 EV 模拟
# ============================================================

def make_build(route, realm, lv, nodes):
    b = REALMS[realm].copy()
    r = ROUTES[route]
    crit, cd = BASE_CRIT, BASE_CD
    atk_pct = hp_pct = def_pct = 0.0
    shield_pct = thorns = 0.0
    p = dict(init=0, per_hit=0, coef=0.0, cap=0, burst=0.0)
    sq_need, burst_mult = 99, 0.0
    lowhp_dr = 0.0
    if route == "huashan":
        crit += r["grant"]["crit"] + r["per_lv"]["crit"] * lv
        cd += r["grant"]["cd"] + r["per_lv"]["cd"] * lv
        atk_pct += r["per_lv"]["atk_pct"] * lv
        sq_need, burst_mult = r["sword_qi_need"], r["burst_mult"]
        if nodes >= 1: sq_need = 4
        if nodes >= 2: burst_mult = 5.5
        if nodes >= 3: sq_need = 3
    elif route == "shaolin":
        shield_pct = r["grant"]["shield_pct"]
        thorns = r["grant"]["thorns"] + r["per_lv"]["thorns"] * lv
        def_pct = r["grant"]["def_pct"] + r["per_lv"]["def_pct"] * lv
        hp_pct = r["per_lv"]["hp_pct"] * lv
        if nodes >= 1: shield_pct += 0.15
        if nodes >= 2: thorns += 0.15
        if nodes >= 3: lowhp_dr = 0.30
    else:
        g = r["grant"]
        p = dict(init=g["poison_init"], per_hit=g["poison_per_hit"],
                 coef=g["poison_coef"] + r["per_lv"]["poison_coef"] * lv,
                 cap=g["poison_cap"], burst=g["burst_coef"])
        atk_pct += r["per_lv"]["atk_pct"] * lv
        if nodes >= 1: p["init"] += 2
        if nodes >= 2: p["cap"] = 10
        if nodes >= 3: p["burst"] = 0.8
    return dict(hp=b["hp"] * (1 + hp_pct), atk=b["atk"] * (1 + atk_pct),
                dfs=b["dfs"] * (1 + def_pct), hit=b["hit"], dodge=b["dodge"],
                crit=min(crit, 0.80), cd=cd, shield_pct=shield_pct,
                thorns=thorns, poison=p, sq_need=sq_need,
                burst_mult=burst_mult, lowhp_dr=lowhp_dr, route=route)

def hit_chance(hit, dodge):
    return max(HIT_FLOOR, min(1.0, hit / (hit + dodge)))

def mitig(dfs):
    return DEF_K / (DEF_K + dfs)

def fight(build, enemy, boss_dmg_bonus=0.0):
    """EV 确定性回合模拟。返回 (win, rounds, 玩家剩余血量比)"""
    php = build["hp"]
    pshield = build["hp"] * build["shield_pct"]
    ehp = enemy["hp"]
    tags = enemy["tags"]
    is_boss = ("高血" in tags) or ("高防" in tags and "高攻" in tags)
    dmg_mult = (1 + boss_dmg_bonus) if is_boss else 1.0
    sq = 0.0
    elayers = players_poison = ab_stacks = 0.0
    p_hit = hit_chance(build["hit"], enemy["dodge"])
    e_hit = hit_chance(enemy["hit"], build["dodge"])
    for rd in range(1, ROUND_CAP + 1):
        if rd == 1 and build["poison"]["init"]:
            elayers = min(build["poison"]["cap"], build["poison"]["init"])
        # ---- 玩家行动 ----
        crit_ev = (1 - build["crit"]) + build["crit"] * build["cd"]
        dealt = build["atk"] * crit_ev * mitig(enemy["dfs"]) * p_hit * dmg_mult
        if build["sq_need"] < 99:
            sq += p_hit * build["crit"]
            if sq >= build["sq_need"]:
                sq -= build["sq_need"]
                dealt += build["atk"] * build["burst_mult"] * mitig(enemy["dfs"]) * dmg_mult
        if build["poison"]["per_hit"]:
            elayers = min(build["poison"]["cap"], elayers + p_hit * build["poison"]["per_hit"])
        ehp -= dealt
        if "反伤" in tags and dealt > 0:
            refl = dealt * THORNS_ENEMY
            absorb = min(pshield, refl); pshield -= absorb
            php -= (refl - absorb)
        if ehp <= 0:
            return True, rd, max(php, 0) / build["hp"]
        # ---- 敌人行动 ----
        eatk = enemy["atk"]
        if "狂暴" in tags and rd >= ENRAGE_START:
            eatk *= (1 + ENRAGE_STEP * (rd - ENRAGE_START + 1))
        pdfs = build["dfs"] * (1 - min(ab_stacks, 3) * ARMOR_BREAK_PP)
        edmg = eatk * e_hit * mitig(pdfs)
        if build["lowhp_dr"] and php < 0.30 * build["hp"]:
            edmg *= (1 - build["lowhp_dr"])
        absorb = min(pshield, edmg); pshield -= absorb
        php -= (edmg - absorb)
        if build["thorns"] and edmg > 0:
            ehp -= edmg * build["thorns"]   # 反伤按吸收前伤害计
        if "破甲" in tags:
            ab_stacks = min(3, ab_stacks + e_hit)
        if "毒" in tags:
            players_poison = min(5, players_poison + e_hit)
        if ehp <= 0:
            return True, rd, max(php, 0) / build["hp"]
        # ---- 回合结束 ----
        if elayers > 0:
            ehp -= elayers * build["atk"] * build["poison"]["coef"] * dmg_mult
            if elayers >= build["poison"]["cap"] - 1e-9:
                ehp -= build["poison"]["cap"] * build["atk"] * build["poison"]["burst"] * dmg_mult
                elayers = 0
            if ehp <= 0:
                return True, rd, max(php, 0) / build["hp"]
        if players_poison > 0:
            php -= players_poison * enemy["atk"] * ENEMY_POISON_COEF  # 毒绕过护盾
        if "净化" in tags and rd % PURIFY_EVERY == 0:
            elayers = 0
        if php <= 0:
            return False, rd, 0.0
    return False, ROUND_CAP, max(php, 0) / build["hp"]

# ============================================================
# 首轮经济/时间线模拟（贪心策略）
# ============================================================

def run_playthrough(route, neili_mult=1.0, boss_dmg_bonus=0.0,
                    early_realm_discount=0.0, verbose=False):
    """early_realm_discount: 快速入门节点——境界 2/3 突破消耗折减"""
    stages = build_stages()
    t = neili = yueli = silver = 0.0
    realm, lv, nodes, idx = 1, 0, 0, 0
    events = []       # (时间min, 消息, 是否里程碑)

    def realm_cost(r):
        c = REALMS[r]["cost"]
        return c * (1 - early_realm_discount) if r in (2, 3) else c

    def log(msg, mile=True):
        events.append((t / 60, msg, mile))
        if verbose and mile:
            print(f"  [{t/60:5.1f} min] {msg}")

    def elapse(dt):
        nonlocal t, neili
        t += dt
        neili += idle_rate(realm, neili_mult) * dt

    def wait_for(amount):
        # 充能式突破/储蓄：缺口按 1/5 分段注入，每段为一次可见进展
        while neili < amount - 1e-9:
            chunk = min(amount - neili, amount / 5)
            elapse(chunk / idle_rate(realm, neili_mult))
            log("充能进度 +1/5", mile=False)

    log("开局：境界 1")
    while idx < len(stages) and t < 5400:
        while nodes < 3 and yueli >= MECH_NODE_COST[nodes]:
            yueli -= MECH_NODE_COST[nodes]; nodes += 1
            log(f"购买机制节点 {nodes}（阅历）")
        build = make_build(route, realm, lv, nodes) if realm >= 2 else \
            dict(**REALMS[1], crit=BASE_CRIT, cd=BASE_CD, shield_pct=0, thorns=0,
                 poison=dict(init=0, per_hit=0, coef=0, cap=0, burst=0),
                 sq_need=99, burst_mult=0, lowhp_dr=0, route="none")
        m, i, enemy, reward = stages[idx]
        win, rounds, _ = fight(build, enemy, boss_dmg_bonus)
        elapse(BATTLE_OVERHEAD_S)
        if win:
            neili += reward["neili"]; silver += reward["silver"]; yueli += reward["yueli"]
            boss = i in (8, 10) and any(tg in enemy["tags"] for tg in ("高血", "高防"))
            log(f"通过 {m}-{i}" + (f"（Boss，{rounds} 回合）" if boss else ""), mile=boss)
            idx += 1
            continue
        # 失败 → 升级决策：节点 > 武学（受境界上限）> 境界 > 等最便宜项
        lv_cap = min(10, realm * SKILL_LV_CAP_PER_REALM)
        opts = []
        if lv < lv_cap:
            opts.append(("skill", skill_cost(lv + 1)))
        if realm < 5:
            opts.append(("realm", realm_cost(realm + 1)))
        if not opts:
            log("!!! 卡死：满配仍无法通过"); break
        aff = [o for o in opts if neili >= o[1]]
        kind, cost = (min(aff, key=lambda o: o[1]) if aff
                      else min(opts, key=lambda o: o[1]))
        wait_for(cost)
        neili -= cost
        if kind == "skill":
            lv += 1
            log(f"武学升至 {lv} 级", mile=False)
        else:
            realm += 1
            log(f"突破境界 {realm}" + ("（解锁三路线，选择构筑）" if realm == 2 else ""))
    while realm < 5 and t < 5400:
        wait_for(realm_cost(realm + 1))
        neili -= realm_cost(realm + 1); realm += 1
        log(f"突破境界 {realm}")
    done = idx >= len(stages) and realm == 5
    log("达成归隐条件（境界5+Boss3）" if done else "!!! 未在时限内完成")
    return events, t / 60, dict(realm=realm, lv=lv, nodes=nodes,
                                yueli=yueli, silver=silver)

def key_times(events):
    out = {}
    for tm, msg, _ in events:
        if "境界 2" in msg: out["realm2"] = tm
        if "map1-8" in msg: out["boss1"] = tm
        if "map2-10" in msg: out["boss2"] = tm
        if "map3-10" in msg: out["boss3"] = tm
        if "归隐条件" in msg and "!!!" not in msg: out["done"] = tm
    return out

def anchor_report(route):
    print(f"\n===== 路线：{route} =====")
    ev, total, st = run_playthrough(route, verbose=True)
    tt = key_times(ev)
    # 第二轮：旧梦重温（内力 +20%）+ 快速入门（境界 2/3 突破消耗 -30%）
    ev2, _, _ = run_playthrough(route, neili_mult=1.20, early_realm_discount=0.30)
    t2 = key_times(ev2)
    gaps = [b - a for (a, _, _), (b, _, _) in zip(ev, ev[1:])]
    print(f"  首轮总时长 {total:.0f} min | 终态 {st}")
    if "boss2" in tt and "boss2" in t2:
        sp = 1 - t2["boss2"] / tt["boss2"]
        print(f"  第二轮到 Boss2: {t2['boss2']:.1f} min（首轮 {tt['boss2']:.1f}）提速 {sp*100:.0f}%")
    if "done" in t2 and "done" in tt:
        print(f"  第二轮归隐达成: {t2['done']:.1f} min（首轮 {tt['done']:.1f}）")
    print(f"  最大无进展间隔: {max(gaps):.1f} min")
    ok = (5 <= tt.get("realm2", 0) <= 8 and 12 <= tt.get("boss1", 0) <= 18
          and 25 <= tt.get("boss2", 0) <= 35 and 45 <= tt.get("done", 99) <= 60
          and max(gaps) <= 5
          and 0.25 <= 1 - t2.get("boss2", 99) / tt.get("boss2", 1) <= 0.45)
    print(f"  锚点: realm2={tt.get('realm2',0):.1f} boss1={tt.get('boss1',0):.1f} "
          f"boss2={tt.get('boss2',0):.1f} done={tt.get('done',0):.1f} "
          f"-> {'PASS' if ok else 'CHECK'}")
    return ok

def boss_matrix():
    stages = build_stages()
    bosses = {"B1": stages[7][2], "B2": stages[17][2], "B3": stages[27][2]}
    configs = [(2, 3, 0), (2, 4, 0), (3, 6, 1), (4, 7, 2), (4, 8, 2), (5, 8, 2), (5, 10, 3)]
    print("\n===== Boss 胜负矩阵（W/L+回合，配置=境界/武学/节点） =====")
    header = "  route   " + "".join(f"{b}@r{r}l{l}n{n}".ljust(11) for b in bosses for r, l, n in configs)
    for route in ROUTES:
        cells = []
        for bname, be in bosses.items():
            for r, l, n in configs:
                w, rds, _ = fight(make_build(route, r, l, n), be)
                cells.append(f"{bname}r{r}l{l}:{'W' if w else 'L'}{rds}")
        print(f"  {route.ljust(8)} " + " ".join(cells))

if __name__ == "__main__":
    results = [anchor_report(r) for r in ("huashan", "shaolin", "tangmen")]
    boss_matrix()
    print("\n总体：", "ALL PASS" if all(results) else "存在未达锚点项，需调参")
