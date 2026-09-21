#!/usr/bin/env python3
"""
受伤系统求解器 —— 伤势 / 自愈 / 折寿 / 战死 的数值地基。

设计来源：docs/systems/injury/design.md（§1 来源 / §2 恢复 / §3 伤型 / §4 severity / §5 折寿）。

它做什么：
    复用 mvp0_sim 的战斗与构筑原语，自己搭一个「带伤势的撞墙循环」——
    硬仗失败或惨胜留下伤势，伤势压属性、压挂机产出，随游戏内时间自愈；
    伤势升到重度开始折寿，再升一档越过致死线则当场不治、强制转世。

核心对照（design.md §2.4「恢复机制顺便解掉死亡螺旋」）：
    稳健画像 —— 失败后先养伤再升级重试，伤势始终回落
    硬撑画像 —— 失败后立刻重试，不养伤，伤势一路升档直至战死

golden 红线：只调用 mvp0_sim 的 fight() / make_build()，不改其任何函数。

用法：python3 docs/systems/sim/injury_sim.py
"""
from __future__ import annotations
import copy
import mvp0_sim as m
import reincarnation_sim as R

# ═══════════════════════════════════════════════════════════
# 外生假设（拍板项；injury/design.md §6 待标定清单）
# ═══════════════════════════════════════════════════════════

# severity：0=无 1=轻 2=中 3=重 4=越致死线
SEV_NAME = {0: "无", 1: "轻", 2: "中", 3: "重"}
SEV_LETHAL = 4

# 各档属性压制幅度（design.md §3：外伤压防/血、内伤压攻/挂机、毒伤压命中闪避）
PRESS = {1: 0.10, 2: 0.25, 3: 0.45}

# 各伤型对「挂机内力产出」的压制权重（乘在 PRESS 上）。
# 武侠逻辑：修炼靠经脉运行气血——内伤伤在根子上最狠，毒伤须分心镇压居中，外伤只是痛得难以入定。
# 内伤保持招牌地位但不致命（裁决：75%，原议 100% 过狠）。
IDLE_WEIGHT = {"内伤": 0.75, "毒伤": 0.45, "外伤": 0.25}
IDLE_FLOOR = 0.40   # 多伤并存时挂机产出地板，避免修炼归零

# 各档自愈时长（游戏内分钟，降一档所需）——轻快重慢，差距拉明显（§2.3）
HEAL_MIN = {1: 3.0, 2: 8.0, 3: 20.0}
HEAL_REALM_BONUS = 0.05   # 境界次要修正：每境界自愈快 5%

# 惨胜阈值：关键战通关后剩余血量低于此值 → 留伤（§1）
PYRRHIC_HP = 0.25

# 折寿（§5）：伤势升入重度时一次性折损寿元年数；重度再升 → 越致死线
LIFESPAN_LOSS_HEAVY = 15.0

# 硬撑画像在被迫升级前，最多原地重试几次
RECKLESS_RETRIES = 3

TIME_CAP_SEC = 5400

# 三图轮的 Boss 关（content.md §2）
BOSS_STAGES = {("map1", 8), ("map2", 10), ("map3", 10)}


# ═══════════════════════════════════════════════════════════
# 伤势状态
# ═══════════════════════════════════════════════════════════

class Injuries:
    """三类伤势：外伤 / 内伤 / 毒伤。各自一条 severity 轴，独立升降（§4）。"""

    TYPES = ("外伤", "内伤", "毒伤")

    def __init__(self):
        self.sev = {k: 0 for k in self.TYPES}
        self.heal_acc = {k: 0.0 for k in self.TYPES}
        self.lifespan_lost = 0.0
        self.dead = False
        self.inflicted = 0          # 累计受伤次数（V7 稀疏度）
        self.heavy_events = 0       # 累计升入重度次数（V8）

    def inflict(self, kind: str, realm: int) -> str:
        """受一次伤：该伤型 severity +1。升入重度折寿；越致死线则死。"""
        self.inflicted += 1
        s = self.sev[kind] + 1
        if s >= SEV_LETHAL:
            self.sev[kind] = 3
            self.dead = True
            return f"{kind}越致死线——伤重不治"
        self.sev[kind] = s
        self.heal_acc[kind] = 0.0
        if s == 3:
            self.heavy_events += 1
            self.lifespan_lost += LIFESPAN_LOSS_HEAVY
            return f"{kind}恶化至重度（折寿 {LIFESPAN_LOSS_HEAVY:.0f} 年）"
        return f"{kind}·{SEV_NAME[s]}"

    def heal(self, minutes: float, realm: int) -> None:
        """按游戏内时间自愈：攒够该档时长则降一档（§2.1 / §2.3）。"""
        factor = max(0.5, 1.0 - HEAL_REALM_BONUS * (realm - 1))
        for k in self.TYPES:
            while self.sev[k] > 0 and minutes > 0:
                need = HEAL_MIN[self.sev[k]] * factor - self.heal_acc[k]
                if minutes >= need:
                    minutes -= need
                    self.sev[k] -= 1
                    self.heal_acc[k] = 0.0
                else:
                    self.heal_acc[k] += minutes
                    minutes = 0

    def any_hurt(self) -> bool:
        return any(v > 0 for v in self.sev.values())

    def heal_time_needed(self, realm: int) -> float:
        """养到全愈还需多少游戏内分钟（稳健画像用）。"""
        factor = max(0.5, 1.0 - HEAL_REALM_BONUS * (realm - 1))
        total = 0.0
        for k in self.TYPES:
            if self.sev[k] > 0:
                total = max(total, sum(HEAL_MIN[s] for s in range(1, self.sev[k] + 1)) * factor
                            - self.heal_acc[k])
        return total

    def idle_penalty(self) -> float:
        """三类伤各按权重压挂机内力产出（§3）：乘法叠加，设地板。"""
        mult = 1.0
        for k, s in self.sev.items():
            if s:
                mult *= (1.0 - PRESS[s] * IDLE_WEIGHT[k])
        return max(IDLE_FLOOR, mult)

    def label(self) -> str:
        parts = [f"{k}·{SEV_NAME[v]}" for k, v in self.sev.items() if v > 0]
        return " ".join(parts) if parts else "无伤"


def injured_build(build: dict, inj: Injuries) -> dict:
    """把伤势叠加到构筑上（design.md §0 红线：只改喂进 fight() 的 Build，不碰 fight()）。"""
    if not inj.any_hurt():
        return build
    b = copy.deepcopy(build)
    wai, nei, du = inj.sev["外伤"], inj.sev["内伤"], inj.sev["毒伤"]
    if wai:
        b["dfs"] *= (1 - PRESS[wai])
        b["hp"] *= (1 - PRESS[wai] * 0.66)
    if nei:
        b["atk"] *= (1 - PRESS[nei])
    if du:
        b["hit"] *= (1 - PRESS[du])
        b["dodge"] *= (1 - PRESS[du])
    return b


def injury_kind(enemy: dict, kind: str) -> str:
    """伤型归属：带毒标签→毒伤，Boss→外伤，精英→内伤（§1 预留 C 的最小形态）。"""
    if "毒" in enemy.get("tags", []):
        return "毒伤"
    return "外伤" if kind == "boss" else "内伤"


# ═══════════════════════════════════════════════════════════
# 带伤势的撞墙循环
# ═══════════════════════════════════════════════════════════

def run_life(route="huashan", profile="prudent", verbose=False):
    """profile: prudent 稳健（失败先养伤再升级） / reckless 硬撑（失败立刻重试）"""
    stages = m.build_stages()
    inj = Injuries()
    t = neili = 0.0
    realm, lv, nodes, idx = 1, 0, 0, 0
    yueli = 0.0
    retries = 0
    heal_minutes = 0.0      # 累计闭关养伤时长（V9 时间税）
    fought_hurt = 0         # 带伤出战次数（权衡画像的核心指标）
    log_lines = []

    def elapse(dt_sec):
        """推进时间：产出内力（受内伤压制），同时自愈。"""
        nonlocal t, neili
        t += dt_sec
        mins = dt_sec / 60
        neili += m.idle_rate(realm) * inj.idle_penalty() * dt_sec
        inj.heal(mins, realm)

    def wait_for(amount):
        guard = 0
        while neili < amount - 1e-9 and t < TIME_CAP_SEC and guard < 500:
            rate = m.idle_rate(realm) * inj.idle_penalty()
            chunk = min(amount - neili, amount / 5)
            elapse(chunk / rate)
            guard += 1

    def rebuild():
        if realm >= 2:
            return m.make_build(route, realm, lv, nodes)
        return dict(**m.REALMS[1], crit=m.BASE_CRIT, cd=m.BASE_CD, shield_pct=0, thorns=0,
                    poison=dict(init=0, per_hit=0, coef=0, cap=0, burst=0),
                    sq_need=99, burst_mult=0, lowhp_dr=0, plain_mult=1.0,
                    first_crit=False, route="none")

    def note(msg):
        log_lines.append(f"[{t/60:6.1f}min] {msg}")
        if verbose:
            print(f"  [{t/60:6.1f}min] {msg}")

    while idx < len(stages) and t < TIME_CAP_SEC and not inj.dead:
        while nodes < 3 and yueli >= m.MECH_NODE_COST[nodes]:
            yueli -= m.MECH_NODE_COST[nodes]; nodes += 1

        base = rebuild()
        mp, i, enemy, reward = stages[idx]
        is_boss = (mp, i) in BOSS_STAGES
        kind = "boss" if is_boss else ("elite" if enemy["tags"] else "normal")
        is_key = kind in ("boss", "elite")

        # ---- 开打前：带伤打，还是先养伤？（权衡发生在这里）----
        if inj.any_hurt() and is_key:
            if profile == "prudent":
                need = inj.heal_time_needed(realm)
                note(f"闭关养伤 {need:.1f} 分钟（{inj.label()}）")
                elapse(need * 60); heal_minutes += need
                base = rebuild()
            elif profile == "pragmatic":
                # 理性权衡：带现有伤能赢就直接打，省下养伤时间；赢不了才养
                trial_win, _, _ = m.fight(injured_build(base, inj), enemy, 0.0)
                if trial_win:
                    fought_hurt += 1
                    note(f"带伤出战 {mp}-{i}（{inj.label()}）")
                else:
                    need = inj.heal_time_needed(realm)
                    note(f"带伤必败，闭关养伤 {need:.1f} 分钟（{inj.label()}）")
                    elapse(need * 60); heal_minutes += need
                    base = rebuild()

        win, rounds, hp_left = m.fight(injured_build(base, inj), enemy, 0.0)
        elapse(m.BATTLE_OVERHEAD_S)

        if win:
            neili += reward["neili"]; yueli += reward["yueli"]
            # 惨胜：关键战低血通关也留伤（§1）
            if is_key and hp_left < PYRRHIC_HP:
                msg = inj.inflict(injury_kind(enemy, kind), realm)
                note(f"惨胜 {mp}-{i}（余血 {hp_left*100:.0f}%）→ {msg}")
                if inj.dead:
                    break
            idx += 1
            retries = 0
            continue

        # ---- 失败 ----
        if is_key:
            msg = inj.inflict(injury_kind(enemy, kind), realm)
            note(f"败于 {mp}-{i} → {msg}｜当前 {inj.label()}")
            if inj.dead:
                break

        if profile == "reckless" and retries < RECKLESS_RETRIES:
            # 硬撑：不养伤、不升级，立刻再来
            retries += 1
            continue

        lv_cap = min(10, realm * m.SKILL_LV_CAP_PER_REALM)
        opts = []
        if lv < lv_cap: opts.append(("skill", m.skill_cost(lv + 1)))
        if realm < 5: opts.append(("realm", m.REALMS[realm]["cost"]))
        if not opts:
            note("无可升级项，保底归隐")
            break
        aff = [o for o in opts if neili >= o[1]]
        pick, cost = (min(aff, key=lambda o: o[1]) if aff else min(opts, key=lambda o: o[1]))
        wait_for(cost)
        if neili < cost:
            note("时限内攒不够，收手")
            break
        neili -= cost
        if pick == "skill":
            lv += 1
        else:
            realm += 1
            note(f"突破境界 {realm}")
        retries = 0

    return dict(
        profile=profile, minutes=t / 60, stages_cleared=idx,
        dead=inj.dead, lifespan_lost=inj.lifespan_lost,
        inflicted=inj.inflicted, heavy_events=inj.heavy_events,
        heal_minutes=heal_minutes, fought_hurt=fought_hurt,
        final=inj.label(), log=log_lines,
    )


# ═══════════════════════════════════════════════════════════
# 判据 V6–V9
# ═══════════════════════════════════════════════════════════

def criteria_report():
    print("=" * 64)
    print("受伤系统 sim —— 判据 V6–V9")
    print("=" * 64)
    print(f"\n外生假设：压制 轻{PRESS[1]:.0%}/中{PRESS[2]:.0%}/重{PRESS[3]:.0%} · "
          f"自愈 轻{HEAL_MIN[1]:.0f}/中{HEAL_MIN[2]:.0f}/重{HEAL_MIN[3]:.0f}min · "
          f"惨胜线 {PYRRHIC_HP:.0%} · 重度折寿 {LIFESPAN_LOSS_HEAVY:.0f}年")

    pru = run_life(profile="prudent")
    rec = run_life(profile="reckless")

    print("\n----- 稳健画像（失败先养伤再升级）-----")
    for line in pru["log"][:10]:
        print("  " + line)
    print(f"  => 通关 {pru['stages_cleared']}/28 关 · {pru['minutes']:.1f}min · "
          f"受伤 {pru['inflicted']} 次 · 重度 {pru['heavy_events']} 次 · "
          f"折寿 {pru['lifespan_lost']:.0f} 年 · 终局 {'战死' if pru['dead'] else '存活'}（{pru['final']}）")

    print("\n----- 硬撑画像（失败立刻重试，不养伤）-----")
    for line in rec["log"][:10]:
        print("  " + line)
    print(f"  => 通关 {rec['stages_cleared']}/28 关 · {rec['minutes']:.1f}min · "
          f"受伤 {rec['inflicted']} 次 · 重度 {rec['heavy_events']} 次 · "
          f"折寿 {rec['lifespan_lost']:.0f} 年 · 终局 {'战死' if rec['dead'] else '存活'}（{rec['final']}）")

    # V6 无死亡螺旋：稳健画像不战死，且能推进
    v6 = (not pru["dead"]) and pru["stages_cleared"] >= 18
    # V7 受伤稀疏度：稳健画像受伤次数落在合理区间（有感但不刷屏）
    v7 = 1 <= pru["inflicted"] <= 15
    # V8 折寿只由重伤触发，且硬撑者代价显著高于稳健者
    v8 = (pru["lifespan_lost"] < rec["lifespan_lost"]) or (rec["dead"] and not pru["dead"])
    # V9 内伤不拖垮进度：稳健画像总时长未因养伤爆炸（≤90 分钟，同 mvp0 C1 口径）
    v9 = pru["minutes"] <= 90

    print("\n----- 判据 -----")
    for label, ok, note_ in [
        ("V6 无死亡螺旋（稳健画像不战死且能推进）", v6,
         f"稳健通关 {pru['stages_cleared']}/28，{'存活' if not pru['dead'] else '战死'}"),
        ("V7 受伤稀疏度（稳健画像 1–15 次）", v7, f"实测 {pru['inflicted']} 次"),
        ("V8 硬撑代价显著高于稳健", v8,
         f"折寿 稳健{pru['lifespan_lost']:.0f}年 vs 硬撑{rec['lifespan_lost']:.0f}年"
         f"{'，硬撑战死' if rec['dead'] else ''}"),
        ("V9 养伤不拖垮进度（稳健 ≤90min）", v9, f"实测 {pru['minutes']:.1f}min"),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note_}")


if __name__ == "__main__":
    criteria_report()
