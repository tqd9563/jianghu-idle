from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from assumptions import load_assumptions
from offline_sim import Checkpoint, RunVariant, evaluate_grid


def test_normalized_candidate_loads_explicit_checkpoint_inputs() -> None:
    # Given
    path = Path(__file__).with_name("normalized-candidate-v0.json")

    # When
    loaded = load_assumptions(path)

    # Then
    assert loaded.assumptions_id == "mvp2b-normalized-candidate-v0"
    assert loaded.grid.run_multipliers[RunVariant.SECOND_RUN] == Decimal("1.28")
    assert loaded.grid.checkpoints[-1].checkpoint is Checkpoint.BEFORE_BOSS_5
    assert loaded.grid.checkpoints[-1].hourly_rate.neili == Decimal("240")


def test_normalized_candidate_produces_reviewable_risk_boundaries() -> None:
    # Given
    loaded = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json"))

    # When
    results = evaluate_grid(loaded.grid)
    first_boss2 = tuple(result for result in results if result.run_variant is RunVariant.FIRST_RUN and result.checkpoint is Checkpoint.BEFORE_BOSS_2)

    # Then
    four_hour_half = next(result for result in first_boss2 if result.requested_hours == Decimal("4") and result.efficiency == Decimal("0.50"))
    eight_hour_half = next(result for result in first_boss2 if result.requested_hours == Decimal("8") and result.efficiency == Decimal("0.50"))
    eight_hour_high = next(result for result in first_boss2 if result.requested_hours == Decimal("8") and result.efficiency == Decimal("0.65"))
    assert four_hour_half.affordable_ids == ("meaningful_investment",)
    assert eight_hour_half.checkpoint_skip_risk is False
    assert eight_hour_high.checkpoint_skip_risk is True
    assert eight_hour_high.one_login_run_collapse_risk is False
