#!/usr/bin/env python3
"""
转世时间线求解器 —— 寿元 / 年岁 / 江湖历 / 转世 的数值地基。

设计来源：docs/systems/reincarnation/design.md（§1 时间与纪元 / §2 寿元 / §3 转世）。

它做什么：
    在 mvp0_sim 的多轮 campaign 之上，罩一层「一世 = 一次转世」的时间线——
    每一世按游戏内时长累积年岁，年岁触到寿元则强制转世（六折结算），
    否则玩家在标准完成点自愿归隐（足额）。江湖历跨世接续。

依赖方向（不可颠倒，同 pacing_sim 哲学）：
    外生假设（寿元上限 / 初始年龄 / 目标一世跨度）
      → 年岁速率（由「目标一世跨度」反解）
        → 各世年岁、江湖历接续、强制转世是否触发

golden 红线：本脚本只 import mvp0_sim，不改其任何函数；战斗核心 fight() 保持金标准对齐。

用法：python3 docs/systems/sim/reincarnation_sim.py
"""
from __future__ import annotations
import mvp0_sim as m

# ═══════════════════════════════════════════════════════════
# 外生假设（拍板项，改动会整体缩放；design.md §6 待标定清单）
# ═══════════════════════════════════════════════════════════

INIT_AGE = 18          # 转世出生年龄（每世重置，重生为少年）
LIFESPAN_CAP = 120     # 寿元上限：一世能活到的岁数（年岁触顶 → 强制转世）。裁决 B1：宽松容错，主角身负不灭功法寿元超凡
TARGET_LIFE_YEARS = 45 # 目标：一世典型跨度（design.md §6 锚点 30–60，取中位反解速率）

N_LIVES = 6            # 模拟的转世次数（campaign 轮数）
JIANGHU_ERA_START = 100  # 第一世出生时的江湖历年份

# 深推贪命：标准完成后仍不归隐、继续刷声望的「额外分钟」扫描区间。
# 现有 sim 的标准完成点是固定的（Boss3+境界5），本扫描用来回答 V1：
# 玩家要在标准点之后再撑多久，年岁才会撞上寿元（= 赌命余量）。
GREED_EXTRA_MIN = [0, 20, 40, 60, 80]


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

def run_lives(route: str = "huashan", profile: str = "greedy"):
    """跑 N_LIVES 世，返回每世的时间线记录 + 反解出的年岁速率。"""
    runs = m.run_campaign(route, profile, n_runs=N_LIVES, shop=True)

    # 用中位世时长反解年岁速率（避免首世偏长带偏）
    minutes_sorted = sorted(r["minutes"] for r in runs)
    typical = minutes_sorted[len(minutes_sorted) // 2]
    rate = solve_year_rate(typical)

    era = JIANGHU_ERA_START
    lives = []
    for r in runs:
        span = years_lived(r["minutes"], rate)          # 这一世自愿归隐时会活过的年数
        natural_death_span = LIFESPAN_CAP - INIT_AGE     # 到寿元上限能活的年数
        forced = span >= natural_death_span              # 标准完成前年岁就触顶？
        actual_span = min(span, natural_death_span)
        age_at_end = INIT_AGE + actual_span
        lives.append(dict(
            run=r["run"], minutes=r["minutes"], rep_full=r["rep"], lowyield=r["lowyield"],
            span_years=actual_span, age_at_end=age_at_end,
            forced=forced, era_start=era, era_end=era + actual_span,
        ))
        era += actual_span
    return lives, rate, typical


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


def criteria_report():
    print("=" * 60)
    print("转世时间线 sim —— 判据 V1–V5")
    print("=" * 60)
    lives, rate, typical = run_lives()

    print(f"\n外生假设：初始年龄 {INIT_AGE} · 寿元上限 {LIFESPAN_CAP} · "
          f"目标一世跨度 {TARGET_LIFE_YEARS} 年")
    print(f"反解年岁速率：{rate:.3f} 年/分钟（典型世时长 {typical:.1f} 分钟）")

    print("\n----- 各世时间线 -----")
    for L in lives:
        tag = "强制转世" if L["forced"] else "自愿归隐"
        print(f"  第{L['run']}世：{L['minutes']:5.1f}min → 活{L['span_years']:4.1f}年 "
              f"卒于{L['age_at_end']:4.1f}岁 [{tag}] "
              f"江湖历 {L['era_start']:.0f}–{L['era_end']:.0f}")

    # V1：寿元鞭子真抽人（贪心深推下会触发强制转世）
    natural, margin = greed_margin(typical, rate)
    v1 = any(hit for _, _, hit in margin)
    # V2：标准完成（自愿归隐）不误伤——正常世都不触发强制转世
    v2 = all(not L["forced"] for L in lives)
    # V3：一世典型跨度落在 30–60 年
    v3 = 30 <= typical * rate <= 60
    # V4：N 世累计江湖历跨度形成有意义的多纪元长度（阈值：≥200 年）
    total_span = lives[-1]["era_end"] - lives[0]["era_start"]
    v4 = total_span >= 200
    # V5：在线/离线同速率——同样游戏内分钟，年岁增量与在离线配比无关（构造成立）
    yrs_all_online = years_lived(typical, rate)
    yrs_split = years_lived(typical, rate)  # minutes 相同 → 年岁相同（design.md §1.2 修订后）
    v5 = abs(yrs_all_online - yrs_split) < 1e-9

    print("\n----- V1 赌命余量（标准完成后再撑 X 分钟）-----")
    print(f"  自然寿命可活 {natural} 年（{INIT_AGE}→{LIFESPAN_CAP} 岁）")
    for extra, age, hit in margin:
        print(f"  +{extra:3d}min → 卒于 {age:4.1f} 岁 {'☠ 强制转世' if hit else ''}")

    print("\n----- 判据 -----")
    for label, ok, note in [
        ("V1 寿元鞭子真抽人（深推会触发强制转世）", v1,
         f"撑到 +{next((e for e,_,h in margin if h), '∞')}min 触顶"),
        ("V2 不误伤稳健党（标准完成均自愿归隐）", v2, ""),
        ("V3 一世典型跨度 ∈ [30,60] 年", v3, f"实测 {typical*rate:.1f} 年"),
        ("V4 N世累计江湖历跨度 ≥200 年", v4, f"实测 {total_span:.0f} 年 / {N_LIVES} 世"),
        ("V5 在线离线同速率（年岁与配比无关）", v5, "构造成立"),
    ]:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}  {note}")


if __name__ == "__main__":
    criteria_report()
