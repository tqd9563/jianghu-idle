from __future__ import annotations

import json
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

from attainment_inputs import load_forecast, validate_reward_parity
from attainment_timeline import ACTIVE_HOURLY_NEILI, EventKind, build_timeline, snapshot_events
from evaluation import derive_candidate_recommendation, evaluate_attainment
from map_rewards import MAP_REWARDS, derive_stage_rewards


def test_map_rewards_match_owner_stage_layout_and_neili_targets() -> None:
    # Given / When
    map_four, map_five = MAP_REWARDS

    # Then
    assert map_four.elite_stages == (3, 6, 8)
    assert map_five.elite_stages == (2, 5, 7, 9)
    assert map_four.boss_stage == map_five.boss_stage == 10
    assert map_four.pre_boss_total.neili == 7134
    assert map_five.pre_boss_total.neili == 15698
    assert (map_four.normal.neili, map_four.elite.neili) == (594, 1190)
    assert (map_five.normal.neili, map_five.elite.neili) == (1206, 2417)


def test_json_reward_mirror_has_strict_parity_with_canonical_derivation() -> None:
    # Given / When / Then
    validate_reward_parity()
    forecast = load_forecast()
    assert forecast.reward_parity_validated is True


def test_reward_search_is_deterministic_and_supports_one_switch() -> None:
    # Given / When
    reward = derive_stage_rewards(6, 3, 7133, 200, 40)

    # Then
    assert reward.normal.neili == 594
    assert reward.elite.neili == 1190
    assert reward.total.silver >= 200
    assert reward.total.yueli >= 40


def test_active_rate_is_exact_constructed_day1_forecast() -> None:
    # Given
    forecast = load_forecast()

    # When / Then
    assert forecast.active_neili_per_hour == (Decimal(50952) - Decimal(7134) - Decimal(8264)) / Decimal(3)
    assert ACTIVE_HOURLY_NEILI == Decimal(35554) / Decimal(3)


def test_timeline_has_unique_sources_and_snapshot_precedes_boss_reward() -> None:
    # Given / When
    events = build_timeline("huashan", Decimal("0.50"))

    # Then
    assert len({event.source_id for event in events}) == len(events)
    snapshots = snapshot_events(events)
    assert [event.checkpoint for event in snapshots] == ["before_boss_4", "before_boss_5"]
    for snapshot in snapshots:
        boss_credit = next(event for event in events if event.source_id == f"huashan.{snapshot.checkpoint}.boss_reward")
        assert snapshot.wall_clock_hour < boss_credit.wall_clock_hour


def test_day3_offline_is_one_incremental_block_and_spend_is_affordable() -> None:
    # Given / When
    events = build_timeline("huashan", Decimal("0.50"))
    offline = [event for event in events if event.kind is EventKind.OFFLINE]
    spend = next(event for event in events if event.kind is EventKind.SPEND)
    first_snapshot = snapshot_events(events)[0]

    # Then
    assert [event.neili for event in offline] == [Decimal(8264), Decimal(8264)]
    assert spend.wall_clock_hour > first_snapshot.wall_clock_hour
    credited_before_spend = sum(event.neili for event in events if event.wall_clock_hour < spend.wall_clock_hour)
    assert credited_before_spend >= -spend.neili


def test_all_routes_emit_equal_independent_resource_snapshots() -> None:
    # Given / When
    result = evaluate_attainment()

    # Then
    assert len(result.route_snapshots) == 18
    for checkpoint in ("before_boss_4", "before_boss_5"):
        rows = [row for row in result.route_snapshots if row.checkpoint == checkpoint and row.efficiency == Decimal("0.50")]
        assert len({(row.neili, row.silver, row.yueli) for row in rows}) == 1
    assert result.recommendation == "candidate_recommendation"
    assert result.evidence == "evidence_forecast"


def test_corrected_balances_and_gate_outcomes_are_exact() -> None:
    # Given / When
    result = evaluate_attainment()

    # Then
    boss4 = next(row for row in result.route_snapshots if row.route == "huashan" and row.efficiency == Decimal("0.50") and row.checkpoint == "before_boss_4")
    boss5 = next(row for row in result.route_snapshots if row.route == "huashan" and row.efficiency == Decimal("0.50") and row.checkpoint == "before_boss_5")
    assert (boss4.neili, boss5.neili) == (Decimal(50952), Decimal(115904))
    assert [(row.efficiency, row.day1_forecast, row.day3_forecast) for row in result.gates] == [
        (Decimal("0.35"), False, False),
        (Decimal("0.50"), True, True),
        (Decimal("0.65"), True, True),
    ]


def test_all_tier_gates_and_blocked_progression_are_table_driven() -> None:
    # Given / When
    result = evaluate_attainment()

    # Then
    expected = {
        Decimal("0.35"): (False, True, True, False, False, True),
        Decimal("0.50"): (True, True, True, True, True, True),
        Decimal("0.65"): (True, True, True, True, True, True),
    }
    for row in result.gates:
        assert (row.meaningful_4h, row.boss4_full_preparation_8h_safe, row.boss5_full_preparation_8h_safe, row.day1_forecast, row.day3_forecast, row.combat_matrix) == expected[row.efficiency]
    blocked = [row for row in result.route_snapshots if row.efficiency == Decimal("0.35") and row.checkpoint == "before_boss_5"]
    assert all(row.available and row.neili is not None and row.neili < Decimal(112132) for row in blocked)
    assert result.qualifying_tiers == (Decimal("0.50"), Decimal("0.65"))
    assert result.production_finalization == "requires_observed_natural_window_playtest"
    assert result.open_limitations == ("whole_run_collapse_unverified_missing_remaining_run_threshold",)


def test_owner_policy_selects_lowest_qualifying_forecast_tier() -> None:
    # Given / When / Then
    assert derive_candidate_recommendation(()).outcome == "no_recommendation"
    assert derive_candidate_recommendation((Decimal("0.65"),)).tier == Decimal("0.65")
    multiple = derive_candidate_recommendation((Decimal("0.65"), Decimal("0.50")))
    assert multiple.outcome == "candidate_recommendation"
    assert multiple.reason == "lowest_qualifying_efficiency"
    assert multiple.tier == Decimal("0.50")


def test_evaluation_derives_fifty_percent_candidate_from_all_gates() -> None:
    # Given / When
    result = evaluate_attainment()

    # Then
    assert result.qualifying_tiers == (Decimal("0.50"), Decimal("0.65"))
    assert result.recommendation == "candidate_recommendation"
    assert result.recommended_efficiency == Decimal("0.50")
    assert result.evidence == "evidence_forecast"


def test_attainment_cli_renders_json() -> None:
    # Given
    script = Path(__file__).with_name("offline_sim.py")

    # When
    completed = subprocess.run(
        [sys.executable, str(script), "--attainment-evaluation", "--json"],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(completed.stdout)

    # Then
    assert payload["recommendation"] == "candidate_recommendation"
    assert payload["recommended_efficiency"] == "0.50"
    assert payload["evidence"] == "evidence_forecast"
    assert {row["efficiency"] for row in payload["gates"]} == {"0.35", "0.50", "0.65"}
