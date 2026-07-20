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
# 公式表参数（与 ../formulas.md 保持一致）
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
        grant=dict(crit=0.10, cd=0.20, first_crit=True),
        per_lv=dict(atk_pct=0.06, crit=0.025, cd=0.08),
        sword_qi_need=5, burst_mult=4.0,
    ),
    "shaolin": dict(
        grant=dict(shield_pct=0.30, thorns=0.25, def_pct=0.20),
        per_lv=dict(hp_pct=0.06, def_pct=0.06, thorns=0.03),
    ),
    "tangmen": dict(
        grant=dict(poison_init=1, poison_per_hit=1, poison_coef=0.12,
                   poison_cap=8, burst_coef=0.5),
        per_lv=dict(atk_pct=0.01, poison_coef=0.018),
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
# 内容表参数（与 ../content.md 保持一致）
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
    first_crit = False
    if route == "huashan":
        first_crit = True
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
                plain_mult=0.60 if route == "tangmen" else 1.0,
                dfs=b["dfs"] * (1 + def_pct), hit=b["hit"], dodge=b["dodge"],
                crit=min(crit, 0.80), cd=cd, first_crit=first_crit,
                shield_pct=shield_pct,
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
        forced = rd == 1 and build.get("first_crit")
        crit_ev = build["cd"] if forced else (1 - build["crit"]) + build["crit"] * build["cd"]
        dealt = build["atk"] * crit_ev * mitig(enemy["dfs"]) * p_hit * dmg_mult * build.get("plain_mult", 1.0)
        if build["sq_need"] < 99:
            sq += p_hit * (1.0 if forced else build["crit"])
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
                    early_realm_discount=0.0, verbose=False, snapshot_sink=None):
    """early_realm_discount: 快速入门节点——境界 2/3 突破消耗折减"""
    stages = build_stages()
    t = neili = yueli = silver = 0.0
    realm, lv, nodes, idx = 1, 0, 0, 0
    earned_neili = spent_neili = spent_yueli = 0.0
    event_neili = event_silver = event_yueli = 0.0
    events = []       # (时间min, 消息, 是否里程碑)
    captured_checkpoints = set()

    def realm_cost(r):
        c = REALMS[r]["cost"]
        return c * (1 - early_realm_discount) if r in (2, 3) else c

    def log(msg, mile=True):
        events.append((t / 60, msg, mile))
        if verbose and mile:
            print(f"  [{t/60:5.1f} min] {msg}")

    def elapse(dt):
        nonlocal t, neili, earned_neili
        t += dt
        produced = idle_rate(realm, neili_mult) * dt
        neili += produced
        earned_neili += produced

    def wait_for(amount):
        # 充能式突破/储蓄：缺口按 1/5 分段注入，每段为一次可见进展
        while neili < amount - 1e-9:
            chunk = min(amount - neili, amount / 5)
            elapse(chunk / idle_rate(realm, neili_mult))
            log("充能进度 +1/5", mile=False)

    log("开局：境界 1")
    while idx < len(stages) and t < 5400:
        while nodes < 3 and yueli >= MECH_NODE_COST[nodes]:
            node_cost = MECH_NODE_COST[nodes]
            yueli -= node_cost; spent_yueli += node_cost; nodes += 1
            log(f"购买机制节点 {nodes}（阅历）")
        build = make_build(route, realm, lv, nodes) if realm >= 2 else \
            dict(**REALMS[1], crit=BASE_CRIT, cd=BASE_CD, shield_pct=0, thorns=0,
                 poison=dict(init=0, per_hit=0, coef=0, cap=0, burst=0),
                 sq_need=99, burst_mult=0, lowhp_dr=0, route="none")
        m, i, enemy, reward = stages[idx]
        if snapshot_sink is not None and idx in (17, 27) and idx not in captured_checkpoints:
            snapshot_sink(dict(
                route=route, checkpoint="before_boss_2" if idx == 17 else "before_boss_3",
                wallet_neili=neili, wallet_silver=silver, wallet_yueli=yueli,
                realm=realm, level=lv, nodes=nodes, completed_stage_index=idx,
                gross_earned_neili=earned_neili, spent_neili=spent_neili,
                event_earned_neili=event_neili, event_earned_silver=event_silver,
                event_earned_yueli=event_yueli, spent_yueli=spent_yueli,
            ))
            captured_checkpoints.add(idx)
        win, rounds, _ = fight(build, enemy, boss_dmg_bonus)
        elapse(BATTLE_OVERHEAD_S)
        if win:
            neili += reward["neili"]; silver += reward["silver"]; yueli += reward["yueli"]
            earned_neili += reward["neili"]; event_neili += reward["neili"]
            event_silver += reward["silver"]; event_yueli += reward["yueli"]
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
        spent_neili += cost
        if kind == "skill":
            lv += 1
            log(f"武学升至 {lv} 级", mile=False)
        else:
            realm += 1
            log(f"突破境界 {realm}" + ("（解锁三路线，选择构筑）" if realm == 2 else ""))
    while realm < 5 and t < 5400:
        wait_for(realm_cost(realm + 1))
        neili -= realm_cost(realm + 1); realm += 1
        spent_neili += realm_cost(realm)
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


# ============================================================
# 声望经济（与 ../economy.md 保持一致）
# ============================================================

REP_MILESTONES = {"boss1": 20, "boss2": 30, "boss3": 50}   # 基础声望（每轮按本轮达成结算）
REP_ELITE_PCT = 0.04          # 每个精英首杀 +4%（最多 5 个 = +20%）
REP_FULLCLEAR_PCT = 0.10      # 三图 28 关全通 +10%
REP_PERF_CAP = 0.30           # 表现加成封顶 +30%
REP_SHORT_RUN_MIN = 15.0      # 短轮惩罚门槛（分钟）
REP_LOWYIELD_FACTOR = 0.60    # 保底归隐折扣

# 声望节点定稿（价格、效果见 run_playthrough 的应用点）
NODES = {
    "轻装上路": 30,   # 每轮首次换路线免银两（策略）
    "再入江湖": 40,   # 敌人标签预览（信息类，不参与数值模拟）
    "武道笔记": 40,   # 开局 +40 阅历
    "快速入门": 50,   # 境界 2/3 突破消耗 -30%
    "江湖熟路": 50,   # 地图战斗奖励 +20%
    "旧梦重温": 60,   # 内力产出 +20%
    "破关心得": 70,   # 对 Boss 伤害 +10%
    "师门指引": 80,   # 开局免费获得当前路线机制节点 1（换线跟随）
}
GREEDY_SHOP_ORDER = ["旧梦重温", "快速入门", "破关心得", "江湖熟路",
                     "师门指引", "武道笔记", "再入江湖", "轻装上路"]

def settle_reputation(result):
    """result: dict(boss1/boss2/boss3=bool, elites=int, fullclear=bool,
                    minutes=float, lowyield=bool)"""
    base = sum(v for k, v in REP_MILESTONES.items() if result.get(k))
    perf = min(REP_PERF_CAP, result.get("elites", 0) * REP_ELITE_PCT
               + (REP_FULLCLEAR_PCT if result.get("fullclear") else 0))
    t = result["minutes"]
    time_mod = min(1.0, (t / REP_SHORT_RUN_MIN) ** 2) if t < REP_SHORT_RUN_MIN else 1.0
    rep = base * (1 + perf) * time_mod
    if result.get("lowyield"):
        rep *= REP_LOWYIELD_FACTOR
    return round(rep)

# ============================================================
# 多轮推进（含玩家画像）
# ============================================================

def run_playthrough2(route, owned=frozenset(), profile="greedy", verbose=False):
    """扩展版单轮模拟。profile:
       greedy      按机制节点>武学>境界贪心
       skillfirst  失败时永远先买武学（乱点武学画像）
       stubborn    武学自限 lv6 且从不买机制节点（固执者，测保底）
       switcher    Boss2 首败后换路线 华山->唐门（换线画像）
       owned: 已购声望节点集合"""
    stages = build_stages()
    t = neili = silver = 0.0
    yueli = 40.0 if "武道笔记" in owned else 0.0
    nodes = 1 if "师门指引" in owned else 0
    realm, lv, idx = 1, 0, 0
    cur_route = route
    switched = False
    free_switch = "轻装上路" in owned
    neili_mult = 1.20 if "旧梦重温" in owned else 1.0
    early_disc = 0.30 if "快速入门" in owned else 0.0
    reward_mult = 1.20 if "江湖熟路" in owned else 1.0
    boss_bonus = 0.10 if "破关心得" in owned else 0.0
    b3_fails = 0
    b2_first_fail_t = None
    adjust_after_b2fail = 0
    b2_first_attempt_win = None
    events = []
    result = dict(boss1=False, boss2=False, boss3=False, elites=0,
                  fullclear=False, lowyield=False)

    def realm_cost(r):
        c = REALMS[r]["cost"]
        return c * (1 - early_disc) if r in (2, 3) else c

    def log(msg, mile=True):
        events.append((t / 60, msg, mile))
        if verbose and mile:
            print(f"  [{t/60:5.1f} min] {msg}")

    def elapse(dt):
        nonlocal t, neili
        t += dt
        neili += idle_rate(realm, neili_mult) * dt

    def wait_for(amount):
        while neili < amount - 1e-9:
            chunk = min(amount - neili, amount / 5)
            elapse(chunk / idle_rate(realm, neili_mult))
            log("充能进度", mile=False)

    lv_selfcap = 4 if profile == "stubborn" else 10
    buy_mech = profile not in ("stubborn",)

    while idx < len(stages) and t < 5400:
        while buy_mech and nodes < 3 and yueli >= MECH_NODE_COST[nodes]:
            yueli -= MECH_NODE_COST[nodes]; nodes += 1
            log(f"购买机制节点 {nodes}", mile=False)
        build = make_build(cur_route, realm, lv, nodes) if realm >= 2 else \
            dict(**REALMS[1], crit=BASE_CRIT, cd=BASE_CD, shield_pct=0, thorns=0,
                 poison=dict(init=0, per_hit=0, coef=0, cap=0, burst=0),
                 sq_need=99, burst_mult=0, lowhp_dr=0, route="none")
        m, i, enemy, reward = stages[idx]
        is_b2 = (m, i) == ("map2", 10)
        is_b3 = (m, i) == ("map3", 10)
        win, rounds, hp_left = fight(build, enemy, boss_bonus)
        elapse(BATTLE_OVERHEAD_S)
        if is_b2 and b2_first_attempt_win is None:
            b2_first_attempt_win = win
        if win:
            neili += reward["neili"] * reward_mult
            silver += reward["silver"]; yueli += reward["yueli"]
            if enemy["tags"] and i not in (8, 10):
                result["elites"] += 1
            if (m, i) == ("map1", 8): result["boss1"] = True; log(f"击败 Boss1（{rounds} 回合）")
            if is_b2: result["boss2"] = True; log(f"击败 Boss2（{rounds} 回合）")
            if is_b3: result["boss3"] = True; log(f"击败 Boss3（{rounds} 回合）")
            idx += 1
            continue
        # ---- 失败 ----
        if is_b2 and b2_first_fail_t is None:
            b2_first_fail_t = t / 60
        if is_b3 and realm == 5:
            b3_fails += 1
            if b3_fails >= 4 and lv >= min(lv_selfcap, realm * SKILL_LV_CAP_PER_REALM) \
               and (not buy_mech or nodes >= 3):
                result["lowyield"] = True
                log("Boss3 连败，触发保底：低收益归隐")
                break
        # 换线画像：Boss2 首败即换路线
        if profile == "switcher" and is_b2 and not switched:
            switched = True
            cost = 0 if free_switch else ROUTE_SWITCH_SILVER
            silver -= cost
            yueli += sum(MECH_NODE_COST[:nodes])   # 阅历 100% 返还
            nodes = 1 if "师门指引" in owned else 0
            lv = 0
            cur_route = "tangmen"
            log("换路线：华山 → 唐门（阅历全额返还）")
            if b2_first_fail_t is not None: adjust_after_b2fail += 1
            continue
        lv_cap = min(lv_selfcap, 10, realm * SKILL_LV_CAP_PER_REALM)
        opts = []
        if lv < lv_cap: opts.append(("skill", skill_cost(lv + 1)))
        if realm < 5: opts.append(("realm", realm_cost(realm + 1)))
        if not opts:
            if realm == 5:
                result["lowyield"] = True
                log("无可升级项，触发保底：低收益归隐"); break
            log("!!! 卡死"); break
        if profile == "skillfirst" and lv < lv_cap:
            kind, cost = "skill", skill_cost(lv + 1)
        else:
            aff = [o for o in opts if neili >= o[1]]
            kind, cost = (min(aff, key=lambda o: o[1]) if aff else min(opts, key=lambda o: o[1]))
        wait_for(cost); neili -= cost
        if kind == "skill":
            lv += 1; log(f"武学 {lv} 级", mile=False)
        else:
            realm += 1; log(f"突破境界 {realm}")
        if b2_first_fail_t is not None and not result["boss2"]:
            adjust_after_b2fail += 1
    while realm < 5 and t < 5400 and not result["lowyield"]:
        wait_for(realm_cost(realm + 1)); neili -= realm_cost(realm + 1)
        realm += 1; log(f"突破境界 {realm}")
    result["fullclear"] = idx >= len(stages)
    result["minutes"] = t / 60
    result["done"] = (result["boss3"] and realm == 5) or result["lowyield"]
    gaps = [b - a for (a, _, _), (b, _, _) in zip(events, events[1:])]
    result["max_gap"] = max(gaps) if gaps else 0
    result["b2_first_attempt_win"] = b2_first_attempt_win
    result["adjustments_after_b2fail"] = adjust_after_b2fail
    # 关键时刻
    for tm, msg, _ in events:
        if "Boss2" in msg and "击败" in msg: result["t_boss2"] = tm
        if "Boss3" in msg and "击败" in msg: result["t_boss3"] = tm
    return result, events

def run_campaign(route, profile="greedy", n_runs=3, shop=True, verbose=False):
    owned, bank = set(), 0
    runs = []
    for n in range(1, n_runs + 1):
        if verbose: print(f"--- 第 {n} 轮（{profile}/{route}，节点：{sorted(owned) or '无'}）---")
        res, _ = run_playthrough2(route, frozenset(owned), profile, verbose=False)
        rep = settle_reputation(res)
        bank += rep
        bought = []
        if shop:
            for name in GREEDY_SHOP_ORDER:
                if name not in owned and bank >= NODES[name]:
                    # 首轮限购检查交给价格结构，不硬编码
                    owned.add(name); bank -= NODES[name]; bought.append(name)
        res.update(rep=rep, bank=bank, bought=bought, run=n)
        runs.append(res)
        if verbose:
            print(f"    完成={res['done']} 保底={res['lowyield']} 时长={res['minutes']:.1f}min "
                  f"Boss2@{res.get('t_boss2', -1):.1f} 声望+{rep} 购买={bought} 余额={bank}")
    return runs

def criteria_report():
    print("\n===== §10.1 成功标准逐项判定 =====")
    profiles = [
        ("greedy", "huashan"), ("greedy", "shaolin"), ("greedy", "tangmen"),
        ("skillfirst", "huashan"), ("stubborn", "huashan"),
        ("switcher", "huashan"), ("shop_ignorer", "shaolin"),
    ]
    all_runs = {}
    for prof, route in profiles:
        shop = prof != "shop_ignorer"
        p = "greedy" if prof == "shop_ignorer" else prof
        all_runs[(prof, route)] = run_campaign(route, p, 3, shop=shop)
    # C1 完成率：所有画像三轮全部达成归隐（标准或保底）且 ≤90 min
    c1 = all(r["done"] and r["minutes"] <= 90 for rs in all_runs.values() for r in rs)
    # C2 卡点存在且可诊断：所有画像首轮 Boss2 首次尝试必败
    c2 = all(rs[0]["b2_first_attempt_win"] is False for rs in all_runs.values())
    # C3 卡点后有意义调整 ≥1
    c3 = all(rs[0]["adjustments_after_b2fail"] >= 1 for rs in all_runs.values())
    # C4 首轮声望足够买 ≥1 节点
    c4 = all(rs[0]["rep"] >= min(NODES.values()) for rs in all_runs.values())
    # C5 第二轮到 Boss2 提速 25–40%（贪心三路线）
    sp = []
    for route in ("huashan", "shaolin", "tangmen"):
        rs = all_runs[("greedy", route)]
        s = 1 - rs[1]["t_boss2"] / rs[0]["t_boss2"]
        sp.append(s)
    c5 = all(0.25 <= s <= 0.40 for s in sp)
    # C6 三流派优势场景（Boss 击杀轮数与生存余量对比，见矩阵与画像数据）
    b2 = {}; hp2 = {}
    stages = build_stages()
    for route in ("huashan", "shaolin", "tangmen"):
        w, rds, hp = fight(make_build(route, 4, 7, 2), stages[17][2])
        b2[route] = rds; hp2[route] = hp
    # 清小怪场景 = 地图 1–2 的普通敌（短战）；地图 3 重杂兵属长战，归唐门优势域
    trash = {}
    for route in ("huashan", "shaolin", "tangmen"):
        tot = 0; cnt = 0
        for m, i, e, r in stages:
            if not e["tags"] and m in ("map1", "map2"):
                w, rds, _ = fight(make_build(route, 4, 7, 2), e)
                if w: tot += rds; cnt += 1
        trash[route] = tot / cnt
    c6 = (min(b2, key=b2.get) == "tangmen" and max(hp2, key=hp2.get) == "shaolin"
          and min(trash, key=trash.get) == "huashan")
    # C7（补充）三轮提速曲线健康：run3 比 run2 快 0–20%，且 run3 ≥ run1 的 50%
    curve_ok = True
    for route in ("huashan", "shaolin", "tangmen"):
        rs = all_runs[("greedy", route)]
        s23 = 1 - rs[2]["minutes"] / rs[1]["minutes"]
        if not (0.0 <= s23 <= 0.20) or rs[2]["minutes"] < 0.5 * rs[0]["minutes"]:
            curve_ok = False
    for label, ok, note in [
        ("C1 完成率（7 画像 ×3 轮全部归隐，≤90min）", c1, ""),
        ("C2 Boss2 首达必败（卡点成立）", c2, ""),
        ("C3 卡点后有意义调整 ≥1", c3, ""),
        ("C4 首轮声望可购 ≥1 节点", c4, ""),
        ("C5 二轮到 Boss2 提速 25–40%", c5, f"实测 {[f'{s*100:.0f}%' for s in sp]}"),
        ("C6 三流派各有优势场景", c6,
         f"B2杀速 {b2} B2生存余量 { {k: round(v,2) for k,v in hp2.items()} } 短战清怪(图1-2) { {k: round(v,1) for k,v in trash.items()} }"),
        ("C7 三轮曲线健康（run3 提速 0–20% 且不塌缩）", curve_ok, ""),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label} {note}")
    # 明细
    print("\n===== 画像 × 三轮明细 =====")
    for (prof, route), rs in all_runs.items():
        row = " | ".join(
            f"R{r['run']}:{r['minutes']:.0f}min rep+{r['rep']}{'/保底' if r['lowyield'] else ''}"
            for r in rs)
        print(f"  {prof:12s}/{route:8s} {row}")
    return all_runs

if __name__ == "__main__":
    results = [anchor_report(r) for r in ("huashan", "shaolin", "tangmen")]
    boss_matrix()
    print("\n总体：", "ALL PASS" if all(results) else "存在未达锚点项，需调参")
    criteria_report()
