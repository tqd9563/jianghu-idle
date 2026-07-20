from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from assumptions import load_assumptions
from offline_sim import evaluate_grid
from summary import summarize_efficiencies


def test_summary_evaluates_twelve_run_checkpoint_cells_per_efficiency() -> None:
    # Given
    results = evaluate_grid(load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid)

    # When
    summaries = summarize_efficiencies(results)

    # Then
    assert len(summaries) == 3
    assert all(summary.evaluated_cells == 12 for summary in summaries)


def test_summary_uses_four_hour_investment_and_eight_hour_risk_slices() -> None:
    # Given
    results = evaluate_grid(load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid)

    # When
    by_efficiency = {summary.efficiency: summary for summary in summarize_efficiencies(results)}

    # Then
    assert by_efficiency[Decimal("0.35")].four_hour_investment_cells == 2
    assert by_efficiency[Decimal("0.50")].four_hour_investment_cells == 12
    assert by_efficiency[Decimal("0.50")].eight_hour_checkpoint_risk_cells == 8
    assert by_efficiency[Decimal("0.65")].eight_hour_checkpoint_risk_cells == 12
    assert by_efficiency[Decimal("0.65")].eight_hour_collapse_risk_cells == 0
