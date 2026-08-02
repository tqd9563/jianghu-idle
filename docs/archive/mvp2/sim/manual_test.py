#!/usr/bin/env python3.11
"""Manual test runner for MVP-2 sim modules (no pytest dependency)."""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

# Add sim directory to path
sys.path.insert(0, str(Path(__file__).parent))

from assumptions import load_assumptions
from combat_tuning import BOSS_SPECS, build_matrix
from map_rewards import MAP_REWARDS
from offline_sim import Checkpoint, RunVariant, evaluate_grid


def test_combat_tuning_boss_specs() -> None:
    """Boss 4/5 specs match content.md §8.2"""
    assert BOSS_SPECS[4].hp == 3024
    assert BOSS_SPECS[4].atk == 470
    assert BOSS_SPECS[4].defense == 422
    assert BOSS_SPECS[4].hit == 160
    assert BOSS_SPECS[4].dodge == 25
    assert BOSS_SPECS[4].tags == ("high_defense", "high_attack")

    assert BOSS_SPECS[5].hp == 5376
    assert BOSS_SPECS[5].atk == 504
    assert BOSS_SPECS[5].defense == 722
    assert BOSS_SPECS[5].hit == 172
    assert BOSS_SPECS[5].dodge == 28
    assert BOSS_SPECS[5].tags == ("high_attack", "cleanse", "high_defense")
    print("  ✓ combat_tuning: BOSS_SPECS match content.md §8.2")


def test_combat_matrix_has_passing_adjustments() -> None:
    """All boss/route combos have at least one passing adjustment"""
    matrix = build_matrix()
    for row in matrix:
        assert row.has_passing_combat_adjustment, f"Boss {row.boss} route {row.route} has no passing adjustment"
    print("  ✓ combat_tuning: All 6 matrix rows have passing adjustments")


def test_map_rewards_match_content() -> None:
    """Map 4/5 rewards match content.md §9.1"""
    map4, map5 = MAP_REWARDS
    assert map4.map_id == 4
    assert map4.stages == 10
    assert map4.elite_stages == (3, 6, 8)
    assert map4.normal.neili == 594
    assert map4.normal.silver == 17
    assert map4.normal.yueli == 3
    assert map4.elite.neili == 1190
    assert map4.elite.silver == 33
    assert map4.elite.yueli == 8
    assert map4.pre_boss_total.neili == 7134
    assert map4.pre_boss_total.silver == 201
    assert map4.pre_boss_total.yueli == 42

    assert map5.map_id == 5
    assert map5.stages == 10
    assert map5.elite_stages == (2, 5, 7, 9)
    assert map5.normal.neili == 1206
    assert map5.normal.silver == 16
    assert map5.normal.yueli == 4
    assert map5.elite.neili == 2417
    assert map5.elite.silver == 30
    assert map5.elite.yueli == 5
    assert map5.pre_boss_total.neili == 15698
    assert map5.pre_boss_total.silver == 200
    assert map5.pre_boss_total.yueli == 40
    print("  ✓ map_rewards: Map 4/5 rewards match content.md §9.1")


def test_normalized_candidate_loads() -> None:
    """Normalized candidate v0 loads correctly"""
    path = Path(__file__).with_name("normalized-candidate-v0.json")
    loaded = load_assumptions(path)
    assert loaded.assumptions_id == "mvp2b-normalized-candidate-v0"
    assert loaded.grid.run_multipliers[RunVariant.SECOND_RUN] == Decimal("1.28")
    assert loaded.grid.checkpoints[-1].checkpoint is Checkpoint.BEFORE_BOSS_5
    assert loaded.grid.checkpoints[-1].hourly_rate.neili == Decimal("240")
    print("  ✓ assumptions: normalized-candidate-v0.json loads correctly")


def test_risk_boundaries() -> None:
    """Risk boundaries are reviewable"""
    loaded = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json"))
    results = evaluate_grid(loaded.grid)
    first_boss2 = tuple(result for result in results if result.run_variant is RunVariant.FIRST_RUN and result.checkpoint is Checkpoint.BEFORE_BOSS_2)

    four_hour_half = next(result for result in first_boss2 if result.requested_hours == Decimal("4") and result.efficiency == Decimal("0.50"))
    eight_hour_half = next(result for result in first_boss2 if result.requested_hours == Decimal("8") and result.efficiency == Decimal("0.50"))
    eight_hour_high = next(result for result in first_boss2 if result.requested_hours == Decimal("8") and result.efficiency == Decimal("0.65"))

    assert four_hour_half.affordable_ids == ("meaningful_investment",)
    assert eight_hour_half.checkpoint_skip_risk is False
    assert eight_hour_high.checkpoint_skip_risk is True
    assert eight_hour_high.one_login_run_collapse_risk is False
    print("  ✓ offline_sim: Risk boundaries reviewable (4h/8h/0.50/0.65)")


def main() -> None:
    print("Running MVP-2 sim manual tests...")
    print()

    test_combat_tuning_boss_specs()
    test_combat_matrix_has_passing_adjustments()
    test_map_rewards_match_content()
    test_normalized_candidate_loads()
    test_risk_boundaries()

    print()
    print("All tests passed ✓")


if __name__ == "__main__":
    main()
