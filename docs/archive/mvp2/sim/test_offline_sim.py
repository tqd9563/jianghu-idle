from __future__ import annotations

from decimal import Decimal

from offline_sim import (
    AbsenceHours,
    Checkpoint,
    CheckpointAssumptions,
    Efficiency,
    Investment,
    ResourceBundle,
    RunVariant,
    ScenarioGrid,
    evaluate_grid,
    settle_offline,
)


def _checkpoint(checkpoint: Checkpoint) -> CheckpointAssumptions:
    return CheckpointAssumptions(
        checkpoint=checkpoint,
        hourly_rate=ResourceBundle(neili=Decimal("100"), silver=Decimal("10"), experience=Decimal("2")),
        bank=ResourceBundle.zero(),
        investments=(
            Investment("first", ResourceBundle(neili=Decimal("100"), silver=Decimal("10"), experience=Decimal("2"))),
            Investment("gate", ResourceBundle(neili=Decimal("200"), silver=Decimal("20"), experience=Decimal("4"))),
        ),
        checkpoint_gate_ids=("gate",),
        remaining_run_ids=("first", "gate"),
    )


def test_settlement_caps_absence_at_eight_hours() -> None:
    # Given
    assumptions = _checkpoint(Checkpoint.BEFORE_BOSS_2)

    # When
    result = settle_offline(assumptions, AbsenceHours(Decimal("12")), Efficiency(Decimal("0.5")), Decimal("1"))

    # Then
    assert result.effective_hours == Decimal("8")
    assert result.earned.neili == Decimal("400")


def test_grid_contains_all_fixed_comparisons() -> None:
    # Given
    grid = ScenarioGrid(
        checkpoints=tuple(_checkpoint(checkpoint) for checkpoint in Checkpoint),
        run_multipliers={
            RunVariant.FIRST_RUN: Decimal("1"),
            RunVariant.SECOND_RUN: Decimal("1.1"),
            RunVariant.LATER_RUN: Decimal("1.2"),
        },
    )

    # When
    results = evaluate_grid(grid)

    # Then
    assert len(results) == 108
    assert {result.efficiency for result in results} == {Decimal("0.35"), Decimal("0.50"), Decimal("0.65")}
    assert {result.requested_hours for result in results} == {Decimal("2"), Decimal("4"), Decimal("8")}


def test_affordability_sets_risk_signals_without_progression() -> None:
    # Given
    assumptions = _checkpoint(Checkpoint.BEFORE_BOSS_3)

    # When
    result = settle_offline(assumptions, AbsenceHours(Decimal("4")), Efficiency(Decimal("0.5")), Decimal("1"))

    # Then
    assert result.affordable_ids == ("first", "gate")
    assert result.checkpoint_skip_risk is True
    assert result.one_login_run_collapse_risk is True
