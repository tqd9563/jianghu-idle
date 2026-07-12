from __future__ import annotations

import json
from decimal import Decimal

from real_evaluation import evaluate_real_grid, render_real_report_json
from rate_comparison import (
    BASE_HOURLY_NEILI,
    MARTIAL_COSTS,
    calibrate_base_hourly_rate,
    compare_efficiencies,
    derive_recommendation,
    offline_neili,
)


def test_base_rate_calibration_applies_efficiency_once() -> None:
    # Given / When
    rate = calibrate_base_hourly_rate(Decimal("4132"), Decimal("4"), Decimal("0.50"))

    # Then
    assert rate == Decimal("2066")
    assert BASE_HOURLY_NEILI == rate


def test_comparison_uses_frozen_martial_costs_and_owner_gate() -> None:
    # Given / When
    rows = compare_efficiencies()

    # Then
    assert MARTIAL_COSTS == {
        "before_boss_2": Decimal("1506"),
        "before_boss_3": Decimal("2108"),
        "before_boss_4": Decimal("2952"),
        "before_boss_5": Decimal("4132"),
    }
    assert [(row.efficiency, row.earned_4h, row.lv10_martial_anchor_gate) for row in rows] == [
        (Decimal("0.35"), Decimal("2892"), False),
        (Decimal("0.50"), Decimal("4132"), True),
        (Decimal("0.65"), Decimal("5371"), True),
    ]


def test_offline_settlement_caps_at_eight_hours() -> None:
    # Given / When / Then
    assert offline_neili(Decimal("12"), Decimal("0.50")) == offline_neili(Decimal("8"), Decimal("0.50"))


def test_recommendation_derivation_handles_evidence_and_qualifier_counts() -> None:
    # Given / When / Then
    assert derive_recommendation(False, (Decimal("0.50"),)).reason == "evidence_incomplete"
    assert derive_recommendation(True, (Decimal("0.50"),)).tier == Decimal("0.50")
    assert derive_recommendation(True, (Decimal("0.50"), Decimal("0.65"))).reason == "multiple_qualifying_tiers"
    assert derive_recommendation(True, ()).reason == "no_qualifying_tier"


def test_comparison_withholds_recommendation_when_attainment_evidence_is_incomplete() -> None:
    # Given / When
    payload = json.loads(render_real_report_json())

    # Then
    assert payload["recommendation"] == "no_recommendation"
    assert payload["recommendation_reason"] == "evidence_incomplete"


def test_real_grid_uses_owner_calibration_rate_and_zero_gated_resources() -> None:
    # Given / When
    rows = evaluate_real_grid()

    # Then
    assert len(rows) == 27
    assert {row.offline_earned_silver for row in rows} == {Decimal(0)}
    assert {row.offline_earned_yueli for row in rows} == {Decimal(0)}
    boss_two = next(row for row in rows if row.checkpoint == "before_boss_2" and row.absence_hours == Decimal(2) and row.efficiency == Decimal("0.35"))
    assert boss_two.offline_earned_neili == Decimal("1446")


def test_boss_four_and_five_are_complete_combat_checks() -> None:
    # Given / When
    payload = json.loads(render_real_report_json())

    # Then
    assert payload["boss4_boss5"]["mapping_status"] == "authoritative"
    assert payload["boss4_boss5"]["full_preparation_gate"] == "complete"
    assert payload["boss4_boss5"]["first_fail_adjust_pass_matrix"] == "pass"
    assert payload["boss4_boss5"]["allowed_single_adjustments"] == ["zhoutian_segment", "martial_upgrade", "route_switch"]
    assert payload["boss4_boss5"]["route_switch"] == {"silver": "200", "policy": "optional_non_cumulative"}
    assert payload["boss4_boss5"]["combat_verdict"] == "pass"
    assert payload["boss4_boss5"]["targets"] == {
        "before_boss_4": {"wall_clock": "day_1", "phase_transition": "r5l8_to_r6l9", "first_attempt_baseline": "r6l8"},
        "before_boss_5": {"wall_clock": "day_3", "phase_transition": "r6l9_to_r7l10", "first_attempt_baseline": "r7l9"},
    }
