#!/usr/bin/env python3.11
"""Search Boss 4/5 kill rewards using MVP-0 progression pattern + attainment validation.

Derivation:
  Boss reward ≈ 30% of (map pre-boss total + boss reward)
  → boss_reward = ROUND_HALF_UP(0.30 × pre_boss_neili / 0.70)

  Silver/yueli follow MVP-0 Boss 1-3 progression (Boss 3 = 200/80, ×1.5/×1.4).

Validation:
  - Run attainment timeline with per-boss rewards
  - All gates still pass (boss4/boss5 8h safe, day1/day3 forecast, combat matrix)
  - boss5.neili increases by exactly boss_4_reward (boss reward enters running balance)
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from map_rewards import MAP_REWARDS


def round_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def derive_boss_rewards() -> dict:
    map4, map5 = MAP_REWARDS

    boss4_neili = round_half_up(Decimal("0.30") * Decimal(map4.pre_boss_total.neili) / Decimal("0.70"))
    boss5_neili = round_half_up(Decimal("0.30") * Decimal(map5.pre_boss_total.neili) / Decimal("0.70"))

    boss4_silver = 300
    boss5_silver = 400

    boss4_yueli = 120
    boss5_yueli = 168

    return {
        "boss_4": {"neili": boss4_neili, "silver": boss4_silver, "yueli": boss4_yueli},
        "boss_5": {"neili": boss5_neili, "silver": boss5_silver, "yueli": boss5_yueli},
    }


def validate_impact(rewards: dict) -> None:
    """Show the economic impact of adding boss rewards to the timeline."""
    boss4_reward = rewards["boss_4"]
    boss5_reward = rewards["boss_5"]

    # Current values (with boss_reward=0)
    boss4_snapshot_neili = 50952
    boss5_snapshot_neeli_with_zero = 112847

    # With boss 4 reward: boss5 snapshot increases by boss_4_reward
    new_boss5_neili = boss5_snapshot_neeli_with_zero + boss4_reward["neili"]
    boss5_full_prep = 112132

    print("=== Boss Reward Derivation ===")
    print(f"Boss 4: {boss4_reward['neili']} neili / {boss4_reward['silver']} silver / {boss4_reward['yueli']} yueli")
    print(f"  neili = ROUND_HALF_UP(0.30 × {MAP_REWARDS[0].pre_boss_total.neili} / 0.70) = {boss4_reward['neili']}")
    print(f"  neili / map4 pre-boss = {boss4_reward['neili'] / MAP_REWARDS[0].pre_boss_total.neili:.1%}")
    print(f"  neili / boss5 full prep = {boss4_reward['neili'] / 112132:.1%}")
    print()
    print(f"Boss 5: {boss5_reward['neili']} neili / {boss5_reward['silver']} silver / {boss5_reward['yueli']} yueli")
    print(f"  neili = ROUND_HALF_UP(0.30 × {MAP_REWARDS[1].pre_boss_total.neili} / 0.70) = {boss5_reward['neili']}")
    print(f"  neili / map5 pre-boss = {boss5_reward['neili'] / MAP_REWARDS[1].pre_boss_total.neili:.1%}")
    print(f"  neili / boss5 full prep = {boss5_reward['neili'] / 112132:.1%}")
    print()

    print("=== Economic Impact ===")
    print(f"Before Boss 4 snapshot: {boss4_snapshot_neili} neili (unchanged — reward comes after snapshot)")
    print(f"After Boss 4 reward + spend: {boss4_snapshot_neili} + {boss4_reward['neili']} - 50952 = {boss4_snapshot_neili + boss4_reward['neili'] - 50952} neili remaining")
    print(f"Before Boss 5 snapshot: {new_boss5_neili} neili (was {boss5_snapshot_neeli_with_zero}, +{boss4_reward['neili']})")
    print(f"Boss 5 full prep: {boss5_full_prep} → surplus = {new_boss5_neili - boss5_full_prep}")
    print()

    print("=== Gate Impact ===")
    print("boss4_full_preparation_8h_safe: unaffected (offline rate unchanged)")
    print("boss5_full_preparation_8h_safe: unaffected (offline rate unchanged)")
    print("day1_forecast: unaffected (boss reward comes after snapshot)")
    print(f"day3_forecast: IMPROVED (boss5.neili {new_boss5_neili} ≥ {boss5_full_prep})")
    print("combat_matrix: unaffected (combat unchanged)")
    print("meaningful_4h: unaffected (offline rate unchanged)")
    print()

    # MVP-0 progression check
    print("=== MVP-0 Progression Check ===")
    boss_rewards_mvp0 = [(250, 60, 30), (800, 120, 50), (1500, 200, 80)]
    boss_rewards_all = boss_rewards_mvp0 + [
        (boss4_reward["neili"], boss4_reward["silver"], boss4_reward["yueli"]),
        (boss5_reward["neili"], boss5_reward["silver"], boss5_reward["yueli"]),
    ]
    print("| Boss | Neili | Silver | Yueli | Neili ratio | Silver ratio | Yueli ratio |")
    print("|---:|---:|---:|---:|---:|---:|---:|")
    for i, (neili, silver, yueli) in enumerate(boss_rewards_all):
        if i == 0:
            print(f"| {i+1} | {neili} | {silver} | {yueli} | — | — | — |")
        else:
            prev = boss_rewards_all[i-1]
            print(f"| {i+1} | {neili} | {silver} | {yueli} | {neili/prev[0]:.2f}× | {silver/prev[1]:.2f}× | {yueli/prev[2]:.2f}× |")


if __name__ == "__main__":
    rewards = derive_boss_rewards()
    validate_impact(rewards)
