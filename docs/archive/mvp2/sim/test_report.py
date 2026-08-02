from __future__ import annotations

from decimal import Decimal

from offline_sim import ScenarioResult, render_markdown


def test_markdown_report_is_provisional_and_does_not_rank_efficiencies() -> None:
    # Given
    result = ScenarioResult.synthetic(efficiency=Decimal("0.50"))

    # When
    report = render_markdown("synthetic", (result,))

    # Then
    assert "仅供比较" in report
    assert "最终数值" in report
    assert "最佳" not in report
    assert "推荐效率" not in report
