#!/usr/bin/env python3.11
"""Search MVP-2A elite challenge 4/5 enemy stats.

Constraint (single-solution, mirrors combat_tuning._qualifies — base-line lose + skill+1 win):
  elite_challenge_04_candidate: realm 5, baseline_level 7, tags=("counter",) — 反伤（§6 推荐）
  elite_challenge_05_candidate: realm 6, baseline_level 8, tags=("cleanse", "high_attack") — 净化+高攻（§6 推荐）

Output: EnemyStats (hp/atk/def/hit/dodge/tags) for each, formatted for content.md §5.2 + mvp2Content.ts.

Reference: docs/mvp2/content.md §5 / §6 / §9.4 (trial enemy search workflow).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from combat_tuning import BOSS_SPECS, ROUTES, EnemyStats, REALMS, fight, make_build


def _round_half_up_int(value: int) -> int:
    return value  # _search_one already uses ROUND_HALF_UP via Decimal


def search_elite_challenge(
    challenge: int,
    realm: int,
    baseline_level: int,
    tags: tuple[str, ...],
) -> EnemyStats:
    """Mirror combat_tuning._search_one: dict-order scan over (hp_scale, atk_scale, def_scale).

    Returns the first EnemyStats satisfying: 三路线 baseline_level 全败 + baseline_level+1 至少一胜。
    """
    from decimal import Decimal, ROUND_HALF_UP
    from itertools import product

    base = REALMS[realm]

    def _round_half_up(value: Decimal) -> int:
        return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def _qualifies(enemy: EnemyStats) -> bool:
        baseline = tuple(fight(make_build(route, realm, baseline_level), enemy) for route in ROUTES)
        upgraded = tuple(fight(make_build(route, realm, baseline_level + 1), enemy) for route in ROUTES)
        return all(not r.win for r in baseline) and any(r.win for r in upgraded)

    for hp_scale, atk_scale, defense_scale in product(
        range(100, 3001, 10),  # HP 100%..3000% step 10pp
        range(5, 301, 5),      # ATK 5%..300% step 5pp
        range(20, 501, 10),    # DEF 20%..500% step 10pp
    ):
        enemy = EnemyStats(
            _round_half_up(Decimal(base.hp) * Decimal(hp_scale) / 100),
            _round_half_up(Decimal(base.atk) * Decimal(atk_scale) / 100),
            _round_half_up(Decimal(base.defense) * Decimal(defense_scale) / 100),
            base.hit,
            base.dodge,
            tags,
        )
        if _qualifies(enemy):
            return enemy
    raise LookupError(f"elite_challenge_0{challenge}_candidate")


def render_result(challenge: int, enemy: EnemyStats, realm: int, baseline_level: int, upgrade_level: int) -> str:
    """Render result as content.md §5.2 table row + verification matrix."""
    lines = []
    lines.append(f"=== elite_challenge_0{challenge}_candidate ===")
    lines.append(f"realm={realm}, baseline_level={baseline_level}, upgrade_level={upgrade_level}, tags={enemy.tags}")
    lines.append(f"HP={enemy.hp}  ATK={enemy.atk}  DEF={enemy.defense}  HIT={enemy.hit}  DODGE={enemy.dodge}")
    lines.append("")
    lines.append("=== Verification matrix (三路线 baseline / upgraded) ===")
    lines.append(f"{'route':<10} {'baseline':<25} {'upgraded':<25}")
    for route in ROUTES:
        b = fight(make_build(route, realm, baseline_level), enemy)
        u = fight(make_build(route, realm, upgrade_level), enemy)
        b_str = f"{'WIN' if b.win else 'LOSE'} r{b.rounds} hp{b.hp_ratio:.4f}"
        u_str = f"{'WIN' if u.win else 'LOSE'} r{u.rounds} hp{u.hp_ratio:.4f}"
        lines.append(f"{route:<10} {b_str:<25} {u_str:<25}")
    lines.append("")
    # mvp2Content.ts format
    tag_str = ", ".join(f"'{t}'" for t in enemy.tags)
    lines.append("=== mvp2Content.ts entry (EnemyTag values are Chinese in TS) ===")
    # Translate English tags to Chinese (enemies.ts uses Chinese)
    tag_map = {
        "high_dodge": "高闪",
        "high_defense": "高防",
        "high_attack": "高攻",
        "high_blood": "高血",
        "counter": "反伤",
        "poison": "毒",
        "cleanse": "净化",
        "破甲": "破甲",
        "狂暴": "狂暴",
    }
    cn_tags = [tag_map.get(t, t) for t in enemy.tags]
    cn_tag_str = ", ".join(f"'{t}'" for t in cn_tags)
    lines.append(
        f"  {{ id: 'elite_challenge_0{challenge}_candidate', challenge: {challenge}, map: {challenge}, "
        f"unlockAfterStage: 5, name: '<待文案冻结>', "
        f"hp: {enemy.hp}, atk: {enemy.atk}, defense: {enemy.defense}, hit: {enemy.hit}, dodge: {enemy.dodge}, "
        f"tags: [{cn_tag_str}], recommendedRealm: {realm}, "
        f"rewardRef: {challenge} }}"
    )
    return "\n".join(lines)


def main() -> None:
    # Elite challenge 04: realm 5, baseline r5l7 (lose) → r5l8 (win), tags = counter (反伤)
    e04 = search_elite_challenge(4, 5, 7, ("counter",))
    print(render_result(4, e04, 5, 7, 8))
    print()
    # Elite challenge 05: realm 6, baseline r6l8 (lose) → r6l9 (win), tags = cleanse + high_attack (净化+高攻)
    e05 = search_elite_challenge(5, 6, 8, ("cleanse", "high_attack"))
    print(render_result(5, e05, 6, 8, 9))


if __name__ == "__main__":
    main()
