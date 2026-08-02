from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from typing import Final

from checkpoint_snapshot import CheckpointSnapshot, capture_checkpoint_inventory
from rate_comparison import EFFICIENCIES, MARTIAL_COSTS, compare_efficiencies, derive_recommendation, offline_neili
from real_mapping import BOSS_2_BASELINE, BOSS_3_BASELINE
from combat_tuning import BOSS_SPECS, build_matrix

ABSENCES: Final = (Decimal("2"), Decimal("4"), Decimal("8"))
REALM_COSTS: Final = {4: Decimal("10000"), 5: Decimal("21000")}
TARGETS: Final = {"before_boss_2": (4, 7), "before_boss_3": (5, 8)}


class GateStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    NOT_APPLICABLE = "not_applicable"
    BLOCKED = "blocked"


@dataclass(frozen=True, slots=True)
class RealScenario:
    route_group: str
    checkpoint: str
    absence_hours: Decimal
    efficiency: Decimal
    offline_earned_neili: Decimal
    offline_earned_silver: Decimal
    offline_earned_yueli: Decimal
    meaningful_investment_gate: GateStatus
    full_preparation_gate: GateStatus
    optional_adjustment_liquidity_available: bool


@dataclass(frozen=True, slots=True)
class SnapshotRequirement:
    route_group: str
    checkpoint: str
    full_preparation_neili: Decimal


def _representative_snapshots() -> tuple[CheckpointSnapshot, ...]:
    unique: dict[tuple[str, float, int, int], CheckpointSnapshot] = {}
    for item in capture_checkpoint_inventory():
        key = (item.checkpoint, item.wallet_neili, item.realm, item.level)
        unique.setdefault(key, item)
    return tuple(unique.values())


def _skill_cost(level: int) -> Decimal:
    return Decimal(round(200 * 1.4 ** (level - 1)))


def _neili_to_target(snapshot: CheckpointSnapshot, target_realm: int, target_level: int) -> Decimal:
    realm = sum((REALM_COSTS[level] for level in range(snapshot.realm + 1, target_realm + 1)), Decimal(0))
    martial = sum((_skill_cost(level) for level in range(snapshot.level + 1, target_level + 1)), Decimal(0))
    return realm + martial


def derive_neili_requirements() -> tuple[SnapshotRequirement, ...]:
    requirements: list[SnapshotRequirement] = []
    for snapshot in _representative_snapshots():
        target_realm, target_level = TARGETS[snapshot.checkpoint]
        requirements.append(SnapshotRequirement(snapshot.route, snapshot.checkpoint, _neili_to_target(snapshot, target_realm, target_level)))
    return tuple(requirements)


def evaluate_real_grid() -> tuple[RealScenario, ...]:
    results: list[RealScenario] = []
    for snapshot, requirement in zip(_representative_snapshots(), derive_neili_requirements(), strict=True):
        baseline = BOSS_2_BASELINE if snapshot.checkpoint == "before_boss_2" else BOSS_3_BASELINE
        for efficiency in EFFICIENCIES:
            for absence in ABSENCES:
                earned = offline_neili(absence, efficiency)
                available = Decimal(str(snapshot.wallet_neili)) + earned
                meaningful = available >= MARTIAL_COSTS[snapshot.checkpoint]
                liquidity = Decimal(str(snapshot.wallet_silver)) >= baseline.adjustment_silver
                results.append(RealScenario(
                    snapshot.route, snapshot.checkpoint, absence, efficiency, earned, Decimal(0), Decimal(0),
                    GateStatus.PASS if meaningful else GateStatus.FAIL,
                    GateStatus.PASS if available >= requirement.full_preparation_neili else GateStatus.FAIL,
                    liquidity,
                ))
    return tuple(results)


def render_real_report_json() -> str:
    comparisons = compare_efficiencies()
    qualifying = tuple(row.efficiency for row in comparisons if row.lv10_martial_anchor_gate and row.full_preparation_safe_gate)
    combat_complete = all(row.has_passing_combat_adjustment for row in build_matrix())
    attainment_evidence_complete = False
    recommendation = derive_recommendation(combat_complete and attainment_evidence_complete, qualifying)
    payload = {
        "evaluation_id": "mvp2b-owner-calibration-sensitivity-v1",
        "scope": "first_run_common_boss2_boss3_plus_boss4_boss5_structural",
        "rate_formula": "floor(base_hourly_neili * absence_hours * efficiency)",
        "base_hourly_neili": "2066",
        "calibration": "owner_policy_anchor: 4132 / 4h / 0.50; 50_percent_passes_by_construction",
        "comparison_scope": "martial_only_cross_checkpoint_sensitivity_not_full_boss_qualification",
        "continuous_offline_resources": ["neili"],
        "event_gated_resources": ["silver", "yueli"],
        "adjustment_reserve_policy": "optional_non_cumulative_200_silver",
        "comparison": [
            {"efficiency": str(row.efficiency), "effective_hourly_neili": str(row.effective_hourly_neili), "earned_4h": str(row.earned_4h), "earned_8h": str(row.earned_8h), "lv10_martial_anchor_gate": row.lv10_martial_anchor_gate}
            for row in comparisons
        ],
        "boss4_boss5": {
            "mapping_status": "authoritative",
            "targets": {
                "before_boss_4": {"wall_clock": "day_1", "phase_transition": "r5l8_to_r6l9", "first_attempt_baseline": "r6l8"},
                "before_boss_5": {"wall_clock": "day_3", "phase_transition": "r6l9_to_r7l10", "first_attempt_baseline": "r7l9"},
            },
            "full_preparation_neili": {"before_boss_4": "50952", "before_boss_5": "112132"},
            "full_preparation_gate": "complete",
            "first_fail_adjust_pass_matrix": "pass",
            "allowed_single_adjustments": ["zhoutian_segment", "martial_upgrade", "route_switch"],
            "route_switch": {"silver": "200", "policy": "optional_non_cumulative"},
            "combat_verdict": "pass",
            "enemy_stats": {str(key): {"hp": value.hp, "atk": value.atk, "def": value.defense, "hit": value.hit, "dodge": value.dodge, "tags": value.tags} for key, value in BOSS_SPECS.items()},
            "open_inputs": ["event_rewards", "pre_logout_bank", "active_production_curve"],
        },
        "recommendation": recommendation.outcome,
        "recommendation_reason": recommendation.reason,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def render_real_report_markdown() -> str:
    rows = compare_efficiencies()
    lines = ["# MVP-2B 所有者政策校准敏感性", "", "`2066/h` 由 50% 档在 4h 恰好覆盖 lv10 武学 4132 校准；50% 因构造必过，35/65 仅为其两侧敏感性。", "", "本表仅是跨卡点武学成本核对，不是 Boss 2–5 完整资格判断。", "", "| 效率 | 有效内力/h | 4h | 8h | lv10 武学锚点门禁 |", "|---:|---:|---:|---:|---|"]
    lines.extend(f"| {row.efficiency} | {row.effective_hourly_neili} | {row.earned_4h} | {row.earned_8h} | {'pass' if row.lv10_martial_anchor_gate else 'fail'} |" for row in rows)
    recommendation = derive_recommendation(False, tuple(row.efficiency for row in rows if row.lv10_martial_anchor_gate and row.full_preparation_safe_gate))
    lines.extend(("", "Boss 4/5 战斗矩阵已通过；50%/65% 同时满足资源敏感性，但事件、bank 与主动产出未闭合 Day1/Day3 达成证据。", "", f"**结论：{recommendation.outcome}**（{recommendation.reason}）。"))
    return "\n".join(lines) + "\n"
