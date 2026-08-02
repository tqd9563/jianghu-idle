#!/usr/bin/env python3.11
"""Run all MVP-2 sim tests manually (no pytest dependency)."""

from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from assumptions import load_assumptions
from combat_tuning import BOSS_SPECS, REALMS, ROUTES, Adjustment, EnemyStats, RealmStats, build_matrix, derive_next_realm, search_bosses
from map_rewards import MAP_REWARDS
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
from rate_comparison import BASE_HOURLY_NEILI, MARTIAL_COSTS, calibrate_base_hourly_rate, compare_efficiencies, derive_recommendation, offline_neili
from real_evaluation import evaluate_real_grid, render_real_report_json
from sensitivity import AcceptanceBand, analyze_sensitivity
from real_mapping import (
    BOSS_2_BASELINE,
    BOSS_2_EVENT_CURVE,
    BOSS_2_IDLE_CURVE,
    BOSS_3_BASELINE,
    BOSS_3_EVENT_CURVE,
    BOSS_3_IDLE_CURVE,
    local_idle_hours,
    mapping_report,
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
    assumptions = _checkpoint(Checkpoint.BEFORE_BOSS_2)
    result = settle_offline(assumptions, AbsenceHours(Decimal("12")), Efficiency(Decimal("0.5")), Decimal("1"))
    assert result.effective_hours == Decimal("8")
    assert result.earned.neili == Decimal("400")
    print("  ✓ Settlement caps absence at 8 hours")


def test_grid_contains_all_fixed_comparisons() -> None:
    grid = ScenarioGrid(
        checkpoints=tuple(_checkpoint(checkpoint) for checkpoint in Checkpoint),
        run_multipliers={
            RunVariant.FIRST_RUN: Decimal("1"),
            RunVariant.SECOND_RUN: Decimal("1.1"),
            RunVariant.LATER_RUN: Decimal("1.2"),
        },
    )
    results = evaluate_grid(grid)
    assert len(results) == 108
    assert {result.efficiency for result in results} == {Decimal("0.35"), Decimal("0.50"), Decimal("0.65")}
    assert {result.requested_hours for result in results} == {Decimal("2"), Decimal("4"), Decimal("8")}
    print("  ✓ Grid contains all 108 fixed comparisons")


def test_affordability_sets_risk_signals_without_progression() -> None:
    assumptions = _checkpoint(Checkpoint.BEFORE_BOSS_3)
    result = settle_offline(assumptions, AbsenceHours(Decimal("4")), Efficiency(Decimal("0.5")), Decimal("1"))
    assert result.affordable_ids == ("first", "gate")
    assert result.checkpoint_skip_risk is True
    assert result.one_login_run_collapse_risk is True
    print("  ✓ Affordability sets risk signals without progression")


def test_realm_six_and_seven_are_mechanically_derived_with_half_up_rounding() -> None:
    realm_five = RealmStats(5, 840, 84, 44, 148, 22, 21_000, 10)
    realm_six = derive_next_realm(realm_five, 48_000, 10)
    realm_seven = derive_next_realm(realm_six, 108_000, 10)
    assert realm_six == RealmStats(6, 1680, 168, 88, 160, 25, 48_000, 10)
    assert realm_seven == RealmStats(7, 3360, 336, 176, 172, 28, 108_000, 10)
    assert REALMS[6] == realm_six
    assert REALMS[7] == realm_seven
    print("  ✓ Realm 6/7 derived correctly with half-up rounding")


def test_deterministic_search_reproduces_persisted_bosses() -> None:
    expected = {
        4: EnemyStats(3024, 470, 422, 160, 25, ("high_defense", "high_attack")),
        5: EnemyStats(5376, 504, 722, 172, 28, ("high_attack", "cleanse", "high_defense")),
    }
    selected = search_bosses()
    assert BOSS_SPECS == expected
    assert selected == expected
    print("  ✓ Deterministic search reproduces persisted Boss 4/5 specs")


def test_all_routes_lose_baseline_and_each_has_a_single_adjustment_pass() -> None:
    rows = build_matrix()
    for boss in (4, 5):
        boss_rows = tuple(row for row in rows if row.boss == boss)
        assert {row.route for row in boss_rows} == set(ROUTES)
        assert all(row.baseline.win is False for row in boss_rows)
        assert all(row.has_passing_combat_adjustment for row in boss_rows)
        assert any(row.martial_upgrade.result is not None and row.martial_upgrade.result.win for row in boss_rows)
    print("  ✓ All routes lose baseline, each has passing adjustment")


def test_matrix_matches_route_keyed_expected_adjustments() -> None:
    rows = {(row.boss, row.route): row for row in build_matrix()}
    expected = {
        (4, "huashan"): (False, False, True, True),
        (4, "shaolin"): (False, True, False, False),
        (4, "tangmen"): (False, False, True, True),
        (5, "huashan"): (False, False, True, True),
        (5, "shaolin"): (False, True, True, False),
        (5, "tangmen"): (False, True, True, False),
    }
    assert set(rows) == set(expected)
    for key, (baseline, martial, route_switch, switch_required) in expected.items():
        row = rows[key]
        assert row.baseline.win is baseline
        assert row.martial_upgrade.result is not None
        assert row.martial_upgrade.result.win is martial
        assert row.route_switch.result is not None
        assert row.route_switch.result.win is route_switch
        assert row.route_switch_required is switch_required
        assert row.has_passing_combat_adjustment is True
    print("  ✓ Matrix matches expected route-keyed adjustments")


def test_zhoutian_is_resource_progress_only_and_route_switch_is_not_required() -> None:
    rows = build_matrix()
    assert all(row.zhoutian.adjustment is Adjustment.ZHOUTIAN_SEGMENT for row in rows)
    assert all(row.zhoutian.available is True and row.zhoutian.result is None for row in rows)
    assert all(row.route_switch.available is True for row in rows)
    assert all(row.route_switch_required is False for row in rows if row.martial_upgrade.result is not None and row.martial_upgrade.result.win)
    print("  ✓ Zhoutian is resource-only, route switch not required")


def test_map_rewards_match_content() -> None:
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
    print("  ✓ Map 4/5 rewards match content.md §9.1")


def test_normalized_candidate_loads() -> None:
    path = Path(__file__).with_name("normalized-candidate-v0.json")
    loaded = load_assumptions(path)
    assert loaded.assumptions_id == "mvp2b-normalized-candidate-v0"
    assert loaded.grid.run_multipliers[RunVariant.SECOND_RUN] == Decimal("1.28")
    assert loaded.grid.checkpoints[-1].checkpoint is Checkpoint.BEFORE_BOSS_5
    assert loaded.grid.checkpoints[-1].hourly_rate.neili == Decimal("240")
    print("  ✓ assumptions: normalized-candidate-v0.json loads correctly")


def test_risk_boundaries() -> None:
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


def test_base_rate_calibration_applies_efficiency_once() -> None:
    rate = calibrate_base_hourly_rate(Decimal("4132"), Decimal("4"), Decimal("0.50"))
    assert rate == Decimal("2066")
    assert BASE_HOURLY_NEILI == rate
    print("  ✓ Base rate calibration applies efficiency once")


def test_comparison_uses_frozen_martial_costs_and_owner_gate() -> None:
    rows = compare_efficiencies()
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
    print("  ✓ Comparison uses frozen martial costs and owner gate")


def test_offline_settlement_caps_at_eight_hours() -> None:
    assert offline_neili(Decimal("12"), Decimal("0.50")) == offline_neili(Decimal("8"), Decimal("0.50"))
    print("  ✓ Offline settlement caps at 8 hours")


def test_recommendation_derivation_handles_evidence_and_qualifier_counts() -> None:
    assert derive_recommendation(False, (Decimal("0.50"),)).reason == "evidence_incomplete"
    assert derive_recommendation(True, (Decimal("0.50"),)).tier == Decimal("0.50")
    assert derive_recommendation(True, (Decimal("0.50"), Decimal("0.65"))).reason == "multiple_qualifying_tiers"
    assert derive_recommendation(True, ()).reason == "no_qualifying_tier"
    print("  ✓ Recommendation derivation handles evidence and qualifier counts")


def test_comparison_withholds_recommendation_when_attainment_evidence_is_incomplete() -> None:
    payload = json.loads(render_real_report_json())
    assert payload["recommendation"] == "no_recommendation"
    assert payload["recommendation_reason"] == "evidence_incomplete"
    print("  ✓ Comparison withholds recommendation when attainment evidence is incomplete")


def test_real_grid_uses_owner_calibration_rate_and_zero_gated_resources() -> None:
    rows = evaluate_real_grid()
    assert len(rows) == 27
    assert {row.offline_earned_silver for row in rows} == {Decimal(0)}
    assert {row.offline_earned_yueli for row in rows} == {Decimal(0)}
    boss_two = next(row for row in rows if row.checkpoint == "before_boss_2" and row.absence_hours == Decimal(2) and row.efficiency == Decimal("0.35"))
    assert boss_two.offline_earned_neili == Decimal("1446")
    print("  ✓ Real grid uses owner calibration rate and zero gated resources")


def test_boss_four_and_five_are_complete_combat_checks() -> None:
    payload = json.loads(render_real_report_json())
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
    print("  ✓ Boss 4/5 are complete combat checks")


def test_sensitivity_grid_contains_twenty_seven_combinations() -> None:
    grid = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid
    analyses = analyze_sensitivity(grid)
    assert len(analyses) == 27
    print("  ✓ Sensitivity grid contains 27 combinations")


def test_sensitivity_marks_only_safe_utility_preserving_combinations_feasible() -> None:
    grid = load_assumptions(Path(__file__).with_name("normalized-candidate-v0.json")).grid
    analyses = analyze_sensitivity(grid)
    feasible = tuple(item for item in analyses if item.band is AcceptanceBand.FEASIBLE)
    assert feasible
    assert all(item.four_hour_investment_cells == 12 for item in feasible)
    assert all(item.eight_hour_checkpoint_risk_cells <= 4 for item in feasible)
    assert all(item.eight_hour_collapse_risk_cells == 0 for item in feasible)
    assert any(item.gate_hours == Decimal("5.50") for item in feasible)
    print("  ✓ Sensitivity marks only safe utility-preserving combinations as feasible")


def test_boss_two_baseline_matches_mvp0_incremental_costs() -> None:
    baseline = BOSS_2_BASELINE
    assert baseline.realm_neili == Decimal("10000")
    assert baseline.martial_neili == Decimal("1506")
    assert baseline.full_preparation_neili == Decimal("11506")
    assert baseline.remaining_neili == Decimal("23108")
    print("  ✓ Boss 2 baseline matches MVP-0 incremental costs")


def test_boss_three_full_preparation_ends_at_online_retirement_gate() -> None:
    baseline = BOSS_3_BASELINE
    assert baseline.full_preparation_neili == Decimal("23108")
    assert baseline.remaining_neili == Decimal("0")
    assert baseline.remaining_online_requirements == ("defeat_boss_3", "confirm_retirement")
    print("  ✓ Boss 3 full preparation ends at online retirement gate")


def test_mapping_report_exposes_future_boss_structure_and_open_values() -> None:
    report = mapping_report()
    assert "Boss 4 | authoritative | r5l8 → r6l9（首战 r6l8） | 2952 | 50952" in report
    assert "Boss 5 | authoritative | r6l9 → r7l10（首战 r7l9） | 4132 | 112132" in report
    assert "事件奖励、bank 与主动产出仍是开放输入" in report
    print("  ✓ Mapping report exposes future Boss structure and open values")


def test_boss_two_idle_curve_matches_realm_three_formula() -> None:
    curve = BOSS_2_IDLE_CURVE
    assert curve.realm == 3
    assert curve.neili_per_second == Decimal("14.0625")
    assert curve.neili_per_hour == Decimal("50625")
    print("  ✓ Boss 2 idle curve matches realm 3 formula")


def test_boss_three_idle_curve_matches_realm_four_formula() -> None:
    curve = BOSS_3_IDLE_CURVE
    assert curve.realm == 4
    assert curve.neili_per_second == Decimal("17.578125")
    assert curve.neili_per_hour == Decimal("63281.25")
    print("  ✓ Boss 3 idle curve matches realm 4 formula")


def test_boss_two_event_curve_segments_match_map2_transition_layout() -> None:
    curve = BOSS_2_EVENT_CURVE
    assert curve.map_id == 2
    assert curve.stage_range == (1, 9)
    assert len(curve.segments) == 5
    assert curve.segments[0].stage_start == 1
    assert curve.segments[0].stage_end == 3
    assert curve.segments[0].category == "normal"
    assert curve.segments[0].per_stage.neili == Decimal("150")
    assert curve.segments[0].per_stage.silver == Decimal("20")
    assert curve.segments[0].per_stage.yueli == Decimal("5")
    assert curve.segments[1].category == "elite"
    assert curve.segments[1].per_stage.neili == Decimal("300")
    assert curve.segments[2].stage_start == 5
    assert curve.segments[2].stage_end == 6
    assert curve.segments[2].category == "normal"
    assert curve.segments[3].stage_start == 7
    assert curve.segments[3].stage_end == 7
    assert curve.segments[3].category == "elite"
    assert curve.segments[4].stage_start == 8
    assert curve.segments[4].stage_end == 9
    assert curve.segments[4].category == "normal"
    print("  ✓ Boss 2 event curve segments match map 2 transition layout")


def test_boss_two_event_curve_cumulative_matches_frozen_totals() -> None:
    expected_neili = Decimal("1650")
    expected_silver = Decimal("220")
    expected_yueli = Decimal("55")
    cumulative = BOSS_2_EVENT_CURVE.cumulative
    assert cumulative.neili == expected_neili
    assert cumulative.silver == expected_silver
    assert cumulative.yueli == expected_yueli
    print("  ✓ Boss 2 event curve cumulative matches frozen totals")


def test_boss_three_event_curve_segments_match_map3_transition_layout() -> None:
    curve = BOSS_3_EVENT_CURVE
    assert curve.map_id == 3
    assert curve.stage_range == (1, 9)
    assert len(curve.segments) == 7
    assert curve.segments[0].stage_start == 1
    assert curve.segments[0].stage_end == 2
    assert curve.segments[0].category == "normal"
    assert curve.segments[0].per_stage.neili == Decimal("300")
    assert curve.segments[0].per_stage.silver == Decimal("30")
    assert curve.segments[0].per_stage.yueli == Decimal("8")
    assert curve.segments[1].category == "elite"
    assert curve.segments[1].per_stage.neili == Decimal("500")
    assert curve.segments[2].category == "normal"
    assert curve.segments[3].category == "elite"
    assert curve.segments[4].category == "normal"
    assert curve.segments[5].category == "elite"
    assert curve.segments[6].category == "normal"
    print("  ✓ Boss 3 event curve segments match map 3 transition layout")


def test_boss_three_event_curve_cumulative_matches_frozen_totals() -> None:
    expected_neili = Decimal("3300")
    expected_silver = Decimal("360")
    expected_yueli = Decimal("93")
    cumulative = BOSS_3_EVENT_CURVE.cumulative
    assert cumulative.neili == expected_neili
    assert cumulative.silver == expected_silver
    assert cumulative.yueli == expected_yueli
    print("  ✓ Boss 3 event curve cumulative matches frozen totals")


def test_event_segment_cumulative_is_mechanically_derived() -> None:
    seg = BOSS_2_EVENT_CURVE.segments[0]
    cum = seg.cumulative
    assert seg.stage_count == 3
    assert cum.neili == Decimal("450")
    assert cum.silver == Decimal("60")
    assert cum.yueli == Decimal("15")
    print("  ✓ Event segment cumulative is mechanically derived")


def test_boss_two_local_idle_hours_derives_from_neili_only() -> None:
    expected = Decimal("11506") / Decimal("50625")
    hours = local_idle_hours(BOSS_2_BASELINE, BOSS_2_IDLE_CURVE)
    assert hours == expected
    print("  ✓ Boss 2 local idle hours derives from neili only")


def test_boss_three_local_idle_hours_derives_from_neili_only() -> None:
    expected = Decimal("23108") / Decimal("63281.25")
    hours = local_idle_hours(BOSS_3_BASELINE, BOSS_3_IDLE_CURVE)
    assert hours == expected
    print("  ✓ Boss 3 local idle hours derives from neili only")


def main() -> None:
    print("Running MVP-2 sim manual tests...")
    print()

    test_settlement_caps_absence_at_eight_hours()
    test_grid_contains_all_fixed_comparisons()
    test_affordability_sets_risk_signals_without_progression()
    test_realm_six_and_seven_are_mechanically_derived_with_half_up_rounding()
    test_deterministic_search_reproduces_persisted_bosses()
    test_all_routes_lose_baseline_and_each_has_a_single_adjustment_pass()
    test_matrix_matches_route_keyed_expected_adjustments()
    test_zhoutian_is_resource_progress_only_and_route_switch_is_not_required()
    test_map_rewards_match_content()
    test_normalized_candidate_loads()
    test_risk_boundaries()
    test_base_rate_calibration_applies_efficiency_once()
    test_comparison_uses_frozen_martial_costs_and_owner_gate()
    test_offline_settlement_caps_at_eight_hours()
    test_recommendation_derivation_handles_evidence_and_qualifier_counts()
    test_comparison_withholds_recommendation_when_attainment_evidence_is_incomplete()
    test_real_grid_uses_owner_calibration_rate_and_zero_gated_resources()
    test_boss_four_and_five_are_complete_combat_checks()
    test_sensitivity_grid_contains_twenty_seven_combinations()
    test_sensitivity_marks_only_safe_utility_preserving_combinations_feasible()
    test_boss_two_baseline_matches_mvp0_incremental_costs()
    test_boss_three_full_preparation_ends_at_online_retirement_gate()
    test_mapping_report_exposes_future_boss_structure_and_open_values()
    test_boss_two_idle_curve_matches_realm_three_formula()
    test_boss_three_idle_curve_matches_realm_four_formula()
    test_boss_two_event_curve_segments_match_map2_transition_layout()
    test_boss_two_event_curve_cumulative_matches_frozen_totals()
    test_boss_three_event_curve_segments_match_map3_transition_layout()
    test_boss_three_event_curve_cumulative_matches_frozen_totals()
    test_event_segment_cumulative_is_mechanically_derived()
    test_boss_two_local_idle_hours_derives_from_neili_only()
    test_boss_three_local_idle_hours_derives_from_neili_only()

    print()
    print("All tests passed ✓")


if __name__ == "__main__":
    main()
