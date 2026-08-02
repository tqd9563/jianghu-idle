from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from real_mapping import (
    BOSS_2_BASELINE,
    BOSS_2_EVENT_CURVE,
    BOSS_2_IDLE_CURVE,
    BOSS_3_BASELINE,
    BOSS_3_EVENT_CURVE,
    BOSS_3_IDLE_CURVE,
    EventSegment,
    local_idle_hours,
    mapping_report,
)


# ─── Existing baseline tests (unchanged) ───


def test_boss_two_baseline_matches_mvp0_incremental_costs() -> None:
    # Given / When
    baseline = BOSS_2_BASELINE

    # Then
    assert baseline.realm_neili == Decimal("10000")
    assert baseline.martial_neili == Decimal("1506")
    assert baseline.full_preparation_neili == Decimal("11506")
    assert baseline.remaining_neili == Decimal("23108")


def test_boss_three_full_preparation_ends_at_online_retirement_gate() -> None:
    # Given / When
    baseline = BOSS_3_BASELINE

    # Then
    assert baseline.full_preparation_neili == Decimal("23108")
    assert baseline.remaining_neili == Decimal("0")
    assert baseline.remaining_online_requirements == ("defeat_boss_3", "confirm_retirement")


def test_mapping_report_exposes_future_boss_structure_and_open_values() -> None:
    # Given / When
    report = mapping_report()

    # Then
    assert "Boss 4 | authoritative | r5l8 → r6l9（首战 r6l8） | 2952 | 50952" in report
    assert "Boss 5 | authoritative | r6l9 → r7l10（首战 r7l9） | 4132 | 112132" in report
    assert "事件奖励、bank 与主动产出仍是开放输入" in report


# ─── Idle curve tests ───


def test_boss_two_idle_curve_matches_realm_three_formula() -> None:
    # Given / When
    curve = BOSS_2_IDLE_CURVE

    # Then — 9 × 1.25^2 = 14.0625 neili/s; × 3600 = 50625 neili/h
    assert curve.realm == 3
    assert curve.neili_per_second == Decimal("14.0625")
    assert curve.neili_per_hour == Decimal("50625")


def test_boss_three_idle_curve_matches_realm_four_formula() -> None:
    # Given / When
    curve = BOSS_3_IDLE_CURVE

    # Then — 9 × 1.25^3 = 17.578125 neili/s; × 3600 = 63281.25 neili/h
    assert curve.realm == 4
    assert curve.neili_per_second == Decimal("17.578125")
    assert curve.neili_per_hour == Decimal("63281.25")


# ─── Event curve tests ───


def test_boss_two_event_curve_segments_match_map2_transition_layout() -> None:
    # Given / When
    curve = BOSS_2_EVENT_CURVE

    # Then — map 2 stages 1-9, 5 transition segments
    assert curve.map_id == 2
    assert curve.stage_range == (1, 9)
    assert len(curve.segments) == 5
    # Segment 1: stages 1-3 normal
    assert curve.segments[0].stage_start == 1
    assert curve.segments[0].stage_end == 3
    assert curve.segments[0].category == "normal"
    assert curve.segments[0].per_stage.neili == Decimal("150")
    assert curve.segments[0].per_stage.silver == Decimal("20")
    assert curve.segments[0].per_stage.yueli == Decimal("5")
    # Segment 2: stage 4 elite
    assert curve.segments[1].category == "elite"
    assert curve.segments[1].per_stage.neili == Decimal("300")
    # Segment 3: stages 5-6 normal
    assert curve.segments[2].stage_start == 5
    assert curve.segments[2].stage_end == 6
    assert curve.segments[2].category == "normal"
    # Segment 4: stage 7 elite
    assert curve.segments[3].stage_start == 7
    assert curve.segments[3].stage_end == 7
    assert curve.segments[3].category == "elite"
    # Segment 5: stages 8-9 normal
    assert curve.segments[4].stage_start == 8
    assert curve.segments[4].stage_end == 9
    assert curve.segments[4].category == "normal"


def test_boss_two_event_curve_cumulative_matches_frozen_totals() -> None:
    # Given
    expected_neili = Decimal("1650")
    expected_silver = Decimal("220")
    expected_yueli = Decimal("55")

    # When
    cumulative = BOSS_2_EVENT_CURVE.cumulative

    # Then
    assert cumulative.neili == expected_neili
    assert cumulative.silver == expected_silver
    assert cumulative.yueli == expected_yueli


def test_boss_three_event_curve_segments_match_map3_transition_layout() -> None:
    # Given / When
    curve = BOSS_3_EVENT_CURVE

    # Then — map 3 stages 1-9, 7 transition segments
    assert curve.map_id == 3
    assert curve.stage_range == (1, 9)
    assert len(curve.segments) == 7
    # Segment 1: stages 1-2 normal
    assert curve.segments[0].stage_start == 1
    assert curve.segments[0].stage_end == 2
    assert curve.segments[0].category == "normal"
    assert curve.segments[0].per_stage.neili == Decimal("300")
    assert curve.segments[0].per_stage.silver == Decimal("30")
    assert curve.segments[0].per_stage.yueli == Decimal("8")
    # Segment 2: stage 3 elite
    assert curve.segments[1].stage_start == 3
    assert curve.segments[1].stage_end == 3
    assert curve.segments[1].category == "elite"
    assert curve.segments[1].per_stage.neili == Decimal("500")
    # Segment 3: stage 4 normal
    assert curve.segments[2].stage_start == 4
    assert curve.segments[2].stage_end == 4
    assert curve.segments[2].category == "normal"
    # Segment 4: stage 5 elite
    assert curve.segments[3].stage_start == 5
    assert curve.segments[3].stage_end == 5
    assert curve.segments[3].category == "elite"
    # Segment 5: stage 6 normal
    assert curve.segments[4].stage_start == 6
    assert curve.segments[4].stage_end == 6
    assert curve.segments[4].category == "normal"
    # Segment 6: stage 7 elite
    assert curve.segments[5].stage_start == 7
    assert curve.segments[5].stage_end == 7
    assert curve.segments[5].category == "elite"
    # Segment 7: stages 8-9 normal
    assert curve.segments[6].stage_start == 8
    assert curve.segments[6].stage_end == 9
    assert curve.segments[6].category == "normal"


def test_boss_three_event_curve_cumulative_matches_frozen_totals() -> None:
    # Given
    expected_neili = Decimal("3300")
    expected_silver = Decimal("360")
    expected_yueli = Decimal("93")

    # When
    cumulative = BOSS_3_EVENT_CURVE.cumulative

    # Then
    assert cumulative.neili == expected_neili
    assert cumulative.silver == expected_silver
    assert cumulative.yueli == expected_yueli


def test_event_segment_cumulative_is_mechanically_derived() -> None:
    # Given — map 2 segment 1: stages 1-3, normal, 150 neili/stage
    seg = BOSS_2_EVENT_CURVE.segments[0]

    # When
    cum = seg.cumulative

    # Then — 3 stages × 150 = 450
    assert seg.stage_count == 3
    assert cum.neili == Decimal("450")
    assert cum.silver == Decimal("60")
    assert cum.yueli == Decimal("15")


# ─── Local idle hours tests ───


def test_boss_two_local_idle_hours_derives_from_neili_only() -> None:
    # Given — full_preparation_neili=11506, neili_per_hour=50625
    expected = Decimal("11506") / Decimal("50625")

    # When
    hours = local_idle_hours(BOSS_2_BASELINE, BOSS_2_IDLE_CURVE)

    # Then
    assert hours == expected


def test_boss_three_local_idle_hours_derives_from_neili_only() -> None:
    # Given — full_preparation_neili=23108, neili_per_hour=63281.25
    expected = Decimal("23108") / Decimal("63281.25")

    # When
    hours = local_idle_hours(BOSS_3_BASELINE, BOSS_3_IDLE_CURVE)

    # Then
    assert hours == expected


# ─── JSON parity tests ───


_JSON_PATH = Path(__file__).with_name("real-mapping-v0.json")


def _load_json() -> dict:
    return json.loads(_JSON_PATH.read_text(encoding="utf-8"))


def _assert_segment_parity(json_seg: dict, py_seg: EventSegment, index: int) -> None:
    assert json_seg["stage_start"] == py_seg.stage_start, f"segment {index} stage_start"
    assert json_seg["stage_end"] == py_seg.stage_end, f"segment {index} stage_end"
    assert json_seg["category"] == py_seg.category, f"segment {index} category"
    assert Decimal(json_seg["per_stage"]["neili"]) == py_seg.per_stage.neili, f"segment {index} neili"
    assert Decimal(json_seg["per_stage"]["silver"]) == py_seg.per_stage.silver, f"segment {index} silver"
    assert Decimal(json_seg["per_stage"]["yueli"]) == py_seg.per_stage.yueli, f"segment {index} yueli"


def test_json_mirrors_boss_two_idle_and_event_curves() -> None:
    # Given
    data = _load_json()

    # When
    boss2 = next(cp for cp in data["checkpoints"] if cp["checkpoint"] == "before_boss_2")

    # Then — idle curve parity
    assert boss2["idle_curve"]["realm"] == BOSS_2_IDLE_CURVE.realm
    assert Decimal(boss2["idle_curve"]["neili_per_second"]) == BOSS_2_IDLE_CURVE.neili_per_second
    assert Decimal(boss2["idle_curve"]["neili_per_hour"]) == BOSS_2_IDLE_CURVE.neili_per_hour

    # Then — event curve parity
    assert boss2["event_curve"]["map_id"] == BOSS_2_EVENT_CURVE.map_id
    assert tuple(boss2["event_curve"]["stage_range"]) == BOSS_2_EVENT_CURVE.stage_range
    assert len(boss2["event_curve"]["segments"]) == len(BOSS_2_EVENT_CURVE.segments)
    for i, (json_seg, py_seg) in enumerate(zip(boss2["event_curve"]["segments"], BOSS_2_EVENT_CURVE.segments)):
        _assert_segment_parity(json_seg, py_seg, i)
    cumulative = BOSS_2_EVENT_CURVE.cumulative
    assert Decimal(boss2["event_curve"]["cumulative"]["neili"]) == cumulative.neili
    assert Decimal(boss2["event_curve"]["cumulative"]["silver"]) == cumulative.silver
    assert Decimal(boss2["event_curve"]["cumulative"]["yueli"]) == cumulative.yueli

    # Then — local idle hours parity
    assert Decimal(boss2["local_idle_hours_neili_only"]) == local_idle_hours(BOSS_2_BASELINE, BOSS_2_IDLE_CURVE)


def test_json_owner_calibration_formula_includes_eight_hour_cap() -> None:
    # Given / When
    offline_rate = _load_json()["offline_rate"]

    # Then
    assert offline_rate["base_neili_per_hour"] == "2066"
    assert offline_rate["calibration"] == "4132 / 4 / 0.50"
    assert offline_rate["settlement_formula"] == "floor(base_neili_per_hour * min(hours, 8) * efficiency)"


def test_json_mirrors_boss_three_idle_and_event_curves() -> None:
    # Given
    data = _load_json()

    # When
    boss3 = next(cp for cp in data["checkpoints"] if cp["checkpoint"] == "before_boss_3")

    # Then — idle curve parity
    assert boss3["idle_curve"]["realm"] == BOSS_3_IDLE_CURVE.realm
    assert Decimal(boss3["idle_curve"]["neili_per_second"]) == BOSS_3_IDLE_CURVE.neili_per_second
    assert Decimal(boss3["idle_curve"]["neili_per_hour"]) == BOSS_3_IDLE_CURVE.neili_per_hour

    # Then — event curve parity
    assert boss3["event_curve"]["map_id"] == BOSS_3_EVENT_CURVE.map_id
    assert tuple(boss3["event_curve"]["stage_range"]) == BOSS_3_EVENT_CURVE.stage_range
    assert len(boss3["event_curve"]["segments"]) == len(BOSS_3_EVENT_CURVE.segments)
    for i, (json_seg, py_seg) in enumerate(zip(boss3["event_curve"]["segments"], BOSS_3_EVENT_CURVE.segments)):
        _assert_segment_parity(json_seg, py_seg, i)
    cumulative = BOSS_3_EVENT_CURVE.cumulative
    assert Decimal(boss3["event_curve"]["cumulative"]["neili"]) == cumulative.neili
    assert Decimal(boss3["event_curve"]["cumulative"]["silver"]) == cumulative.silver
    assert Decimal(boss3["event_curve"]["cumulative"]["yueli"]) == cumulative.yueli

    # Then — local idle hours parity
    assert Decimal(boss3["local_idle_hours_neili_only"]) == local_idle_hours(BOSS_3_BASELINE, BOSS_3_IDLE_CURVE)


def test_json_maps_boss_four_and_five_authoritative_costs() -> None:
    # Given
    data = _load_json()

    # When
    boss4 = next(cp for cp in data["checkpoints"] if cp["checkpoint"] == "before_boss_4")
    boss5 = next(cp for cp in data["checkpoints"] if cp["checkpoint"] == "before_boss_5")

    # Then
    assert boss4["status"] == "authoritative"
    assert boss5["status"] == "authoritative"
    assert boss4["martial_neili"] == "2952"
    assert boss5["martial_neili"] == "4132"
    assert boss4["first_attempt_baseline"] == "r6l8"
    assert boss5["first_attempt_baseline"] == "r7l9"
    assert boss4["realm_neili"] == "48000"
    assert boss5["realm_neili"] == "108000"
    assert boss4["full_preparation_neili"] == "50952"
    assert boss5["full_preparation_neili"] == "112132"
    assert boss4["remaining_neili"] == "112132"
    assert boss5["remaining_neili"] == "0"
    assert boss4["first_fail_adjust_pass_matrix"] == "pass"
    assert boss5["first_fail_adjust_pass_matrix"] == "pass"
    assert boss4["combat_verdict"] == "pass"
    assert boss5["combat_verdict"] == "pass"
    assert "idle_curve" not in boss4
    assert "event_curve" not in boss4
    assert "idle_curve" not in boss5
    assert "event_curve" not in boss5


# ─── Report rendering tests ───


def test_mapping_report_renders_idle_and_event_curves() -> None:
    # Given / When
    report = mapping_report()

    # Then — idle hourly rates present
    assert "50625" in report
    assert "63281.25" in report
    # Then — event cumulative totals present
    assert "1650" in report
    assert "3300" in report
    # Then — structural direction is present while absolute values stay blocked
    assert "Boss 4 | authoritative" in report
    assert "Boss 5 | authoritative" in report
    assert "开放输入" in report
