from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from assumptions import load_assumptions
from sensitivity import AcceptanceBand, analyze_sensitivity


def test_sensitivity_grid_contains_twenty_seven_combinations() -> None:
    # Given
    grid = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid

    # When
    analyses = analyze_sensitivity(grid)

    # Then
    assert len(analyses) == 27


def test_sensitivity_marks_only_safe_utility_preserving_combinations_feasible() -> None:
    # Given
    grid = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid

    # When
    analyses = analyze_sensitivity(grid)
    feasible = tuple(item for item in analyses if item.band is AcceptanceBand.FEASIBLE)

    # Then
    assert feasible
    assert all(item.four_hour_investment_cells == 12 for item in feasible)
    assert all(item.eight_hour_checkpoint_risk_cells <= 4 for item in feasible)
    assert all(item.eight_hour_collapse_risk_cells == 0 for item in feasible)
    assert any(item.gate_hours == Decimal("5.50") for item in feasible)
