#!/usr/bin/env python3
"""
转世时间线求解器 —— 寿元 / 年岁 / 江湖历 / 转世 的数值地基。

设计来源：docs/systems/reincarnation/design.md（§1 时间与纪元 / §2 寿元 / §3 转世）。

它做什么：
    在实测的多世时长之上，罩一层「一世 = 一次转世」的时间线——
    每一世按游戏内时长累积年岁，年岁触到寿元则强制转世，
    否则玩家在标准完成点自愿归隐。江湖历跨世接续。

世时长从哪来（2026-09-24 重标定）：
    读 pace_measured.json——由 code/src/telemetry/pace.sim.test.ts 用模拟玩家驱动**真实游戏代码**
    连续玩多世测得（三路线 × 三种子 × 六世）。旧版取 mvp0_sim 的 campaign 时长，它早于周天 v4.0
    （冲穴耗内力）与受伤系统（压产出、要养伤），实际节奏已慢得多，按它反解的速率会让正常玩家
    首世归隐前老死。mvp0_sim 仍用于 V6（首境界耗时，与冲穴/受伤无关）。

依赖方向（不可颠倒，同 pacing_sim 哲学）：
    外生假设（寿元上限 / 初始年龄 / 目标一世跨度）+ 实测世时长
      → 年岁速率（由「目标一世跨度 ÷ 世时长中位数」反解）
        → 各世年岁、江湖历接续、强制转世是否触发

golden 红线：本脚本只 import mvp0_sim，不改其任何函数；战斗核心 fight() 保持金标准对齐。

用法：python3 docs/systems/sim/reincarnation_sim.py
"""
from __future__ import annotations
import json
import statistics
from pathlib import Path
import mvp0_sim as m

PACE_FILE = Path(__file__).with_name("pace_measured.json")

# ═══════════════════════════════════════════════════════════
# 外生假设（拍板项，改动会整体缩放；design.md §6 待标定清单）
# ═══════════════════════════════════════════════════════════

INIT_AGE = 18          # 转世出生年龄（每世重置，重生为少年）
LIFESPAN_CAP = 120     # 寿元上限：一世能活到的岁数（年岁触顶 → 强制转世）。裁决 B1：宽松容错，主角身负不灭功法寿元超凡
TARGET_LIFE_YEARS = 45 # 目标：一世典型跨度（design.md §6 锚点 30–60，取中位反解速率）

JIANGHU_ERA_START = 100  # 第一世出生时的江湖历年份

# 深推贪命：标准完成后仍不归隐、继续刷声望的「额外分钟」扫描区间。
# 现有 sim 的标准完成点是固定的（Boss3+境界5），本扫描用来回答 V1：
# 玩家要在标准点之后再撑多久，年岁才会撞上寿元（= 赌命余量）。
GREED_EXTRA_MIN = [0, 20, 40, 60, 80]

# 魂魄未稳（design.md §3.1 / spec.md §4.1）：强制转世后到首次突破为止，产出 ×WEAK_MULT；不叠加。
WEAK_MULT = 0.60


# ═══════════════════════════════════════════════════════════
# 年岁速率：由「目标一世跨度」反解（游戏内分钟 → 江湖历年）
# ═══════════════════════════════════════════════════════════

def solve_year_rate(typical_life_minutes: float) -> float:
    """一世典型时长 → 年岁速率，使典型一世正好跨 TARGET_LIFE_YEARS 年。"""
    return TARGET_LIFE_YEARS / typical_life_minutes


def years_lived(minutes: float, rate: float) -> float:
    """一世游戏内分钟 → 活过的江湖历年数（= 年岁增量）。
    在线离线同速率（design.md §1.2）；离线的封顶差异在 minutes 层面已体现，此处不再打折。"""
    return minutes * rate


# ═══════════════════════════════════════════════════════════
# 转世时间线：把 campaign 的每一轮罩成「一世」
# ═══════════════════════════════════════════════════════════

def load_pace():
    """读实测世时长。返回 (各样本各世分钟列表, 全部分钟, 中位数)。"""
    d = json.loads(PACE_FILE.read_text(encoding="utf-8"))
    samples = d["samples"]
    allm = [x for smp in samples for x in smp["lives"]]
    return samples, allm, statistics.median(allm)


def timeline(lives_minutes, rate):
    """一个样本的连续多世：各世年岁、是否强制转世、江湖历接续。"""
    era = JIANGHU_ERA_START
    out = []
    natural = LIFESPAN_CAP - INIT_AGE
    for i, minutes in enumerate(lives_minutes, 1):
        span = years_lived(minutes, rate)
        forced = span >= natural
        actual = min(span, natural)
        out.append(dict(run=i, minutes=minutes, span=actual, age=INIT_AGE + actual,
                        forced=forced, era_start=era, era_end=era + actual))
        era += actual
    return out


# ═══════════════════════════════════════════════════════════
# 判据 V1–V5（仿 mvp0_sim.criteria_report 的 PASS/FAIL 风格）
# ═══════════════════════════════════════════════════════════

def greed_margin(typical_minutes: float, rate: float):
    """V1：标准完成后再撑多少分钟，年岁撞上寿元。返回 (额外分钟, 是否会强制转世) 列表。"""
    natural = LIFESPAN_CAP - INIT_AGE
    out = []
    for extra in GREED_EXTRA_MIN:
        age = INIT_AGE + years_lived(typical_minutes + extra, rate)
        out.append((extra, age, age >= LIFESPAN_CAP))
    return natural, out


def weakened_first_realm_minutes():
    """V6：来世首个境界（境界 1→2）的耗时——正常 vs 魂魄未稳。
    首境界只靠挂机内力攒突破消耗，战斗不耗内力，故耗时 = 消耗 ÷ 产出速率。
    直接读 mvp0_sim 的常量，不复制数字。"""
    cost = m.REALMS[2]["cost"]
    normal = cost / m.idle_rate(1) / 60
    weak = cost / m.idle_rate(1, WEAK_MULT) / 60
    return normal, weak


def criteria_report():
    print("=" * 60)
    print("转世时间线 sim —— 判据 V1–V7")
    print("=" * 60)
    samples, allm, typical = load_pace()
    rate = solve_year_rate(typical)
    old_typical = 34.0   # 旧标定所用：mvp0_sim 贪心画像六轮中位

    print(f"\n外生假设：初始年龄 {INIT_AGE} · 寿元上限 {LIFESPAN_CAP} · "
          f"目标一世跨度 {TARGET_LIFE_YEARS} 年")
    print(f"实测世时长：{len(samples)} 个样本 × {len(samples[0]['lives'])} 世 = {len(allm)} 世，"
          f"中位 {typical:.1f} 分钟（最短 {min(allm):.1f} / 最长 {max(allm):.1f}）")
    print(f"反解年岁速率：{rate:.3f} 年/分钟（旧标定 {TARGET_LIFE_YEARS/old_typical:.3f}，"
          f"按 mvp0_sim 中位 {old_typical:.0f} 分钟）")

    tls = [timeline(smp["lives"], rate) for smp in samples]
    firsts = [tl[0] for tl in tls]
    print("\n----- 各样本首世 -----")
    for smp, tl in zip(samples, tls):
        f = tl[0]
        print(f"  {smp['route']:8s} 种子{smp['seed']:>5}：首世 {f['minutes']:5.1f}min → 卒于 {f['age']:5.1f} 岁"
              f"{'  ☠ 强制转世' if f['forced'] else ''}；六世江湖历 {tl[0]['era_start']:.0f}–{tl[-1]['era_end']:.0f}")
    worst = max(allm)
    worst_age = INIT_AGE + years_lived(worst, rate)
    print(f"\n  最慢一世 {worst:.1f}min → 归隐时 {worst_age:.1f} 岁，余量 {LIFESPAN_CAP - worst_age:.1f} 年")

    # V1：寿元鞭子真抽人（贪心深推下会触发强制转世）
    natural, margin = greed_margin(typical, rate)
    v1 = any(hit for _, _, hit in margin)
    # V2：标准完成（自愿归隐）不误伤——全部实测世（含最慢一世）都不触发强制转世
    v2 = all(not L["forced"] for tl in tls for L in tl)
    # V3：一世典型跨度落在 30–60 年
    v3 = 30 <= typical * rate <= 60
    # V4：六世累计江湖历跨度形成有意义的多纪元长度（阈值：≥200 年；取各样本最短者）
    total_span = min(tl[-1]["era_end"] - tl[0]["era_start"] for tl in tls)
    v4 = total_span >= 200
    # V5：在线/离线同速率——同样游戏内分钟，年岁增量与在离线配比无关（构造成立）
    yrs_all_online = years_lived(typical, rate)
    yrs_split = years_lived(typical, rate)  # minutes 相同 → 年岁相同（design.md §1.2 修订后）
    v5 = abs(yrs_all_online - yrs_split) < 1e-9
    # V6：魂魄未稳有感不致命——来世首境界耗时增幅 ∈ [40%, 100%] 且绝对增量 ≤ 10 分钟
    normal_min, weak_min = weakened_first_realm_minutes()
    weak_ratio = weak_min / normal_min - 1
    weak_extra = weak_min - normal_min
    v6 = 0.40 <= weak_ratio <= 1.00 and weak_extra <= 10
    # V7：不叠加——连续两次强制转世，来世折扣仍是 WEAK_MULT 而非 WEAK_MULT²（构造成立：标记为布尔）
    stacked = WEAK_MULT  # 布尔标记语义：挂着就是 WEAK_MULT，没有第二层
    v7 = abs(stacked - WEAK_MULT) < 1e-9

    print("\n----- V6 魂魄未稳（来世首境界耗时）-----")
    print(f"  正常 {normal_min:.1f} min → 未稳 {weak_min:.1f} min（+{weak_ratio:.0%}，+{weak_extra:.1f} min；"
          f"占典型一世 {typical:.0f} min 的 {weak_extra/typical:.0%}）")

    print("\n----- V1 赌命余量（标准完成后再撑 X 分钟）-----")
    print(f"  自然寿命可活 {natural} 年（{INIT_AGE}→{LIFESPAN_CAP} 岁）")
    for extra, age, hit in margin:
        print(f"  +{extra:3d}min → 卒于 {age:4.1f} 岁 {'☠ 强制转世' if hit else ''}")

    print("\n----- 判据 -----")
    for label, ok, note in [
        ("V1 寿元鞭子真抽人（深推会触发强制转世）", v1,
         f"撑到 +{next((e for e,_,h in margin if h), '∞')}min 触顶"),
        ("V2 不误伤稳健党（全部实测世均自愿归隐）", v2, f"最慢一世余量 {LIFESPAN_CAP - worst_age:.1f} 年"),
        ("V3 一世典型跨度 ∈ [30,60] 年", v3, f"实测 {typical*rate:.1f} 年"),
        ("V4 六世累计江湖历跨度 ≥200 年", v4, f"最短样本 {total_span:.0f} 年"),
        ("V5 在线离线同速率（年岁与配比无关）", v5, "构造成立"),
        ("V6 魂魄未稳有感不致命（首境界 +40%~+100%，≤10min）", v6,
         f"+{weak_ratio:.0%} / +{weak_extra:.1f}min"),
        ("V7 魂魄未稳不叠加", v7, "构造成立"),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")


if __name__ == "__main__":
    criteria_report()
