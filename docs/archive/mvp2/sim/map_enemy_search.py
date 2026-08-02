#!/usr/bin/env python3.11
"""Search Map 4/5 stages 1-9 enemy attributes using combat sim validation.

Extends the exponential curve pattern from Maps 1-3 (enemies.ts) to Maps 4/5.
Validates every generated enemy against the combat_tuning.py fight() function
to ensure beatability at the expected player state:

  - Map 4 stages 1-9: player at r5l8 (entry state after Boss 3)
  - Map 5 stages 1-9: player at r6l9 (entry state after Boss 4)

Constraint:
  - Normal enemy: >= 2/3 routes win
  - Elite enemy:   >= 1/3 routes win
  - All fights complete within ROUND_CAP (50) rounds

Tag distribution follows content.md §6:
  Map 4 normal: 高闪, 高防 (variant_high_dodge, variant_high_defense)
  Map 4 elite:  毒   (variant_poison_pressure)
  Map 5 normal: 净化, 高攻 (variant_cleanse, variant_high_attack)
  Map 5 elite:  反伤  (variant_counter)
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Final

# ── reuse combat_tuning infrastructure ──────────────────────────────────────
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from combat_tuning import (
    DEF_K,
    ROUND_CAP,
    ROUTES,
    BOSS_SPECS,
    REALMS,
    Build,
    EnemyStats,
    FightResult,
    RealmStats,
    fight,
    make_build,
)


# ── pyRound (banker's rounding, matches enemies.ts) ────────────────────────

def py_round(x: float, digits: int = 0) -> float:
    """Python round(): banker's rounding (四舍六入五取偶)."""
    m = 10 ** digits
    v = x * m
    floor = int(v)
    diff = v - floor
    eps = 1e-9
    if diff > 0.5 + eps:
        r = floor + 1
    elif diff < 0.5 - eps:
        r = floor
    else:
        r = floor if floor % 2 == 0 else floor + 1
    return r / m


def round_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


# ── curve parameters (extrapolated from Maps 1-3) ──────────────────────────

@dataclass(frozen=True, slots=True)
class CurveParams:
    hp_base: float
    hp_growth: float
    atk_base: float
    atk_growth: float
    def_base: float
    def_growth: float
    hit_base: int       # hit = hit_base + 2 * stage
    dodge: int


# Map 1-3 reference curves (for validation against existing data)
MAP1_CURVE: Final = CurveParams(25, 1.28, 4, 1.17, 2, 1.15, 90, 8)
MAP2_CURVE: Final = CurveParams(115, 1.15, 11, 1.10, 9, 1.12, 105, 12)
MAP3_CURVE: Final = CurveParams(340, 1.14, 24, 1.07, 20, 1.10, 130, 16)

# Map 4/5 curves — extrapolated then validated
MAP4_CURVE: Final = CurveParams(300, 1.16, 50, 1.05, 40, 1.08, 150, 20)
MAP5_CURVE: Final = CurveParams(800, 1.14, 100, 1.04, 80, 1.06, 165, 25)


# ── tag definitions ────────────────────────────────────────────────────────

# Tag names in combat_tuning use English; in enemies.ts use Chinese.
# combat_tuning EnemyStats.tags uses English strings consumed by fight().
# Map between Chinese (enemies.ts) and English (sim) tag names.
TAG_CN_TO_EN: Final = {
    "高闪": "high_dodge",
    "高防": "high_defense",
    "高攻": "high_attack",
    "毒":   "poison",
    "净化": "cleanse",
    "反伤": "thorns",
    "破甲": "armor_break",
    "狂暴": "enrage",
    "高血": "high_hp",
}


@dataclass(frozen=True, slots=True)
class StageEnemy:
    map_id: int
    stage: int
    name: str
    hp: int
    atk: float
    defense: float
    hit: int
    dodge: int
    tags_cn: tuple[str, ...]
    tags_en: tuple[str, ...]
    kind: str   # "normal" | "elite"
    recommended_realm: int


# ── stage layout ────────────────────────────────────────────────────────────

# (stage_index, kind, cn_tags) for each stage
MAP4_LAYOUT: Final = (
    # stage, kind,     cn_tags
    (1, "normal", ()),
    (2, "normal", ("高闪",)),
    (3, "elite",  ("毒",)),
    (4, "normal", ()),
    (5, "normal", ("高防",)),
    (6, "elite",  ("毒",)),
    (7, "normal", ()),
    (8, "elite",  ("毒",)),
    (9, "normal", ("高防",)),
)

MAP5_LAYOUT: Final = (
    (1, "normal", ()),
    (2, "elite",  ("反伤",)),
    (3, "normal", ("净化",)),
    (4, "normal", ("高攻",)),
    (5, "elite",  ("反伤",)),
    (6, "normal", ()),
    (7, "elite",  ("反伤",)),
    (8, "normal", ("高攻",)),
    (9, "elite",  ("反伤",)),
)

MAP4_ELITE_STAGES: Final = (3, 6, 8)
MAP5_ELITE_STAGES: Final = (2, 5, 7, 9)


# ── tag stat modifiers ──────────────────────────────────────────────────────

def apply_tag_modifiers(
    hp: float, atk: float, defense: float, dodge: int,
    tags_cn: tuple[str, ...], kind: str,
) -> tuple[float, float, float, int]:
    """Apply stat modifiers for tags and elite kind."""
    # Elite HP multiplier (from enemies.ts pattern: *1.4, except 毒 which is *1.3)
    if kind == "elite":
        hp *= 1.4
        if "毒" in tags_cn:
            hp = hp / 1.4 * 1.3  # 毒 uses 1.3 instead of 1.4

    for tag in tags_cn:
        if tag == "高闪":
            dodge = 50  # from Map 2 elite@4 pattern
        elif tag == "高防":
            defense *= 1.5
        elif tag == "高攻":
            atk *= 1.3
        # 净化, 毒, 反伤: no stat modifier — the tag itself is the challenge

    return hp, atk, defense, dodge


# ── enemy generation ───────────────────────────────────────────────────────

def generate_stage_enemy(
    map_id: int,
    stage: int,
    kind: str,
    tags_cn: tuple[str, ...],
    curve: CurveParams,
) -> StageEnemy:
    i = stage
    hp = py_round(curve.hp_base * curve.hp_growth ** (i - 1))
    atk = py_round(curve.atk_base * curve.atk_growth ** (i - 1), 1)
    defense = py_round(curve.def_base * curve.def_growth ** (i - 1), 1)
    hit = curve.hit_base + 2 * i
    dodge = curve.dodge

    hp, atk, defense, dodge = apply_tag_modifiers(hp, atk, defense, dodge, tags_cn, kind)

    tags_en = tuple(TAG_CN_TO_EN[t] for t in tags_cn)

    rec_realm = 5 if map_id == 4 else 6

    return StageEnemy(
        map_id=map_id,
        stage=stage,
        name="[待命名]",
        hp=int(hp),
        atk=atk,
        defense=defense,
        hit=hit,
        dodge=dodge,
        tags_cn=tags_cn,
        tags_en=tags_en,
        kind=kind,
        recommended_realm=rec_realm,
    )


def to_sim_enemy(enemy: StageEnemy) -> EnemyStats:
    """Convert StageEnemy to combat_tuning EnemyStats for fight()."""
    return EnemyStats(
        hp=enemy.hp,
        atk=int(round(enemy.atk)),  # sim uses int for atk
        defense=int(round(enemy.defense)),
        hit=enemy.hit,
        dodge=enemy.dodge,
        tags=enemy.tags_en,
    )


# ── validation ─────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class ValidationResult:
    stage: int
    kind: str
    tags: tuple[str, ...]
    hp: int
    atk: float
    defense: float
    hit: int
    dodge: int
    results: tuple[FightResult, ...]
    wins: int
    pass_normal: bool   # >= 2/3 routes win
    pass_elite: bool    # >= 1/3 routes win
    pass_overall: bool
    max_rounds: int
    min_hp_ratio: float


def validate_enemy(
    enemy: StageEnemy,
    realm: int,
    level: int,
) -> ValidationResult:
    sim_enemy = to_sim_enemy(enemy)
    results = tuple(
        fight(make_build(route, realm, level), sim_enemy)
        for route in ROUTES
    )
    wins = sum(1 for r in results if r.win)
    max_rounds = max(r.rounds for r in results)
    min_hp_ratio = min(r.hp_ratio for r in results)

    pass_normal = wins >= 2
    pass_elite = wins >= 1
    pass_overall = pass_normal if enemy.kind == "normal" else pass_elite

    return ValidationResult(
        stage=enemy.stage,
        kind=enemy.kind,
        tags=enemy.tags_cn,
        hp=enemy.hp,
        atk=enemy.atk,
        defense=enemy.defense,
        hit=enemy.hit,
        dodge=enemy.dodge,
        results=results,
        wins=wins,
        pass_normal=pass_normal,
        pass_elite=pass_elite,
        pass_overall=pass_overall,
        max_rounds=max_rounds,
        min_hp_ratio=min_hp_ratio,
    )


# ── curve tuning ───────────────────────────────────────────────────────────

def tune_curve(
    curve: CurveParams,
    layout: tuple,
    realm: int,
    level: int,
    map_id: int,
) -> tuple[CurveParams, list[ValidationResult]]:
    """Try curve parameters; if any stage fails, adjust HP up or down.

    Strategy:
    1. Generate enemies with the initial curve.
    2. Validate each.
    3. If a normal enemy is too hard (0/3 wins), reduce HP by 10%.
    4. If a normal enemy is too easy (3/3 wins in <3 rounds), increase HP by 10%.
    5. Repeat up to 5 iterations.
    """
    current = curve
    for iteration in range(5):
        results = []
        all_pass = True
        for stage, kind, tags in layout:
            enemy = generate_stage_enemy(map_id, stage, kind, tags, current)
            result = validate_enemy(enemy, realm, level)
            results.append(result)
            if not result.pass_overall:
                all_pass = False

        if all_pass:
            return current, results

        # Adjust: find failing stages and adjust their curve base
        hp_base = current.hp_base
        for result in results:
            if not result.pass_overall:
                if result.wins == 0:
                    # Too hard: reduce HP base
                    hp_base *= 0.90
                elif result.kind == "normal" and result.wins == 3 and result.max_rounds < 3:
                    # Too easy: increase HP base
                    hp_base *= 1.10
        current = CurveParams(
            hp_base=hp_base,
            hp_growth=current.hp_growth,
            atk_base=current.atk_base,
            atk_growth=current.atk_growth,
            def_base=current.def_base,
            def_growth=current.def_growth,
            hit_base=current.hit_base,
            dodge=current.dodge,
        )

    # Final validation with adjusted curve
    results = []
    for stage, kind, tags in layout:
        enemy = generate_stage_enemy(map_id, stage, kind, tags, current)
        result = validate_enemy(enemy, realm, level)
        results.append(result)
    return current, results


# ── output ──────────────────────────────────────────────────────────────────

def render_table(results: list[ValidationResult], map_id: int) -> str:
    lines = []
    lines.append(f"### Map {map_id} Stages 1-9 Enemy Search Results\n")
    lines.append("| Stage | Kind | Tags | HP | ATK | DEF | HIT | DODGE | Wins | Max Rounds | Min HP% | Pass |")
    lines.append("|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|")
    for r in results:
        tags_str = ", ".join(r.tags) if r.tags else "—"
        pass_str = "✓" if r.pass_overall else "✗"
        lines.append(
            f"| {r.stage} | {r.kind} | {tags_str} | {r.hp} | {r.atk} | {r.defense} | {r.hit} | {r.dodge} | {r.wins}/3 | {r.max_rounds} | {r.min_hp_ratio:.1%} | {pass_str} |"
        )
    return "\n".join(lines)


def render_route_details(results: list[ValidationResult], map_id: int) -> str:
    lines = []
    lines.append(f"\n<details>\n<summary>Map {map_id} per-route combat details</summary>\n\n")
    for r in results:
        lines.append(f"**Stage {r.stage} ({r.kind})** tags={r.tags}:")
        for route, result in zip(ROUTES, r.results):
            outcome = "WIN" if result.win else "LOSE"
            lines.append(f"  - {route}: {outcome} in {result.rounds} rounds, HP ratio {result.hp_ratio:.1%}")
        lines.append(f"  → {r.wins}/3 wins, pass={r.pass_overall}\n")
    lines.append("\n</details>\n")
    return "\n".join(lines)


def render_enemies_ts(results: list[ValidationResult], map_id: int) -> str:
    """Render in a format suitable for pasting into enemies.ts / mvp2Content.ts."""
    lines = []
    lines.append(f"// Map {map_id}: 10 stages, Boss @{map_id}0")
    elite_stages = MAP4_ELITE_STAGES if map_id == 4 else MAP5_ELITE_STAGES
    elite_str = ", ".join(str(s) for s in elite_stages)
    lines.append(f"// elites@{elite_str}, Boss @{map_id}0")
    lines.append(f"for (let i = 1; i <= 9; i++) {{")
    lines.append(f"  const e = {{")
    lines.append(f"    hp: pyRound(BASE_HP * GROWTH ** (i - 1)),")
    lines.append(f"    atk: pyRound(BASE_ATK * GROWTH_ATK ** (i - 1), 1),")
    lines.append(f"    def: pyRound(BASE_DEF * GROWTH_DEF ** (i - 1), 1),")
    lines.append(f"    hit: HIT_BASE + 2 * i, dodge: DODGE, tags: [] as EnemyTag[],")
    lines.append(f"  }};")
    lines.append(f"  // ... tag and elite overrides")
    lines.append(f"}}")
    lines.append("")
    lines.append(f"// Generated values (validated by sim):")
    for r in results:
        tags_str = ", ".join(f"'{t}'" for t in r.tags) if r.tags else ""
        kind = r.kind
        lines.append(
            f"// s{r.stage} {kind:6s} tags=[{tags_str}]  HP={r.hp:>5d}  ATK={r.atk:>5.1f}  DEF={r.defense:>5.1f}  HIT={r.hit:>3d}  DODGE={r.dodge:>2d}  → {r.wins}/3 wins"
        )
    return "\n".join(lines)


# ── main ───────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 80)
    print("Map 4/5 Stages 1-9 Enemy Search")
    print("=" * 80)

    # ── Map 4 (r5l8) ─────────────────────────────────────────────────────
    print("\n── Map 4 (player at r5l8) ──\n")
    map4_curve, map4_results = tune_curve(
        MAP4_CURVE, MAP4_LAYOUT, 5, 8, 4
    )
    print(f"Curve: HP base={map4_curve.hp_base:.0f} growth={map4_curve.hp_growth}")
    print(f"       ATK base={map4_curve.atk_base:.0f} growth={map4_curve.atk_growth}")
    print(f"       DEF base={map4_curve.def_base:.0f} growth={map4_curve.def_growth}")
    print(f"       HIT base={map4_curve.hit_base}  DODGE={map4_curve.dodge}")
    print()
    print(render_table(map4_results, 4))
    print(render_route_details(map4_results, 4))

    # ── Map 5 (r6l9) ─────────────────────────────────────────────────────
    print("\n── Map 5 (player at r6l9) ──\n")
    map5_curve, map5_results = tune_curve(
        MAP5_CURVE, MAP5_LAYOUT, 6, 9, 5
    )
    print(f"Curve: HP base={map5_curve.hp_base:.0f} growth={map5_curve.hp_growth}")
    print(f"       ATK base={map5_curve.atk_base:.0f} growth={map5_curve.atk_growth}")
    print(f"       DEF base={map5_curve.def_base:.0f} growth={map5_curve.def_growth}")
    print(f"       HIT base={map5_curve.hit_base}  DODGE={map5_curve.dodge}")
    print()
    print(render_table(map5_results, 5))
    print(render_route_details(map5_results, 5))

    # ── Validation summary ─────────────────────────────────────────────
    all_results = map4_results + map5_results
    all_pass = all(r.pass_overall for r in all_results)
    print("\n" + "=" * 80)
    print(f"Total stages: {len(all_results)}")
    print(f"All pass: {'YES' if all_pass else 'NO'}")
    if not all_pass:
        print("\nFailing stages:")
        for r in all_results:
            if not r.pass_overall:
                print(f"  Map {4 if r.stage in (s for s, _, _ in MAP4_LAYOUT) else 5} Stage {r.stage} ({r.kind}): {r.wins}/3 wins")
    print("=" * 80)

    # ── Output for codebase ───────────────────────────────────────────
    print("\n── enemies.ts format ──\n")
    print(render_enemies_ts(map4_results, 4))
    print()
    print(render_enemies_ts(map5_results, 5))


if __name__ == "__main__":
    main()
