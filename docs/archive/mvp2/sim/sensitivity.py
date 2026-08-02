from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from itertools import product

from offline_sim import CheckpointAssumptions, Efficiency, Investment, ResourceBundle, RunVariant, ScenarioGrid, settle_offline

GATE_HOURS = (Decimal("4.50"), Decimal("5.00"), Decimal("5.50"))
SECOND_MULTIPLIERS = (Decimal("1.20"), Decimal("1.24"), Decimal("1.28"))
LATER_MULTIPLIERS = (Decimal("1.26"), Decimal("1.30"), Decimal("1.34"))


class AcceptanceBand(StrEnum):
    FEASIBLE = "feasible_for_real_resource_validation"
    BOUNDARY = "boundary"
    REJECT_CHECKPOINT = "reject_checkpoint_risk"
    REJECT_UTILITY = "reject_four_hour_utility"
    REJECT_COLLAPSE = "reject_run_collapse"


@dataclass(frozen=True, slots=True)
class SensitivityResult:
    gate_hours: Decimal
    second_multiplier: Decimal
    later_multiplier: Decimal
    four_hour_investment_cells: int
    eight_hour_checkpoint_risk_cells: int
    eight_hour_collapse_risk_cells: int
    risk_cell_ids: tuple[str, ...]
    band: AcceptanceBand


def _scaled_gate(checkpoint: CheckpointAssumptions, gate_hours: Decimal) -> CheckpointAssumptions:
    gate = Investment("checkpoint_gate_total", checkpoint.hourly_rate.scaled_floor(gate_hours))
    investments = tuple(gate if item.investment_id == "checkpoint_gate_total" else item for item in checkpoint.investments)
    return CheckpointAssumptions(checkpoint.checkpoint, checkpoint.hourly_rate, checkpoint.bank, investments, checkpoint.checkpoint_gate_ids, checkpoint.remaining_run_ids)


def _band(utility: int, checkpoint_risk: int, collapse: int) -> AcceptanceBand:
    if collapse > 0:
        return AcceptanceBand.REJECT_COLLAPSE
    if utility < 12:
        return AcceptanceBand.REJECT_UTILITY
    if checkpoint_risk <= 4:
        return AcceptanceBand.FEASIBLE
    if checkpoint_risk <= 7:
        return AcceptanceBand.BOUNDARY
    return AcceptanceBand.REJECT_CHECKPOINT


def analyze_sensitivity(base_grid: ScenarioGrid) -> tuple[SensitivityResult, ...]:
    analyses: list[SensitivityResult] = []
    for gate_hours, second, later in product(GATE_HOURS, SECOND_MULTIPLIERS, LATER_MULTIPLIERS):
        checkpoints = tuple(_scaled_gate(checkpoint, gate_hours) for checkpoint in base_grid.checkpoints)
        multipliers = {RunVariant.FIRST_RUN: Decimal("1.00"), RunVariant.SECOND_RUN: second, RunVariant.LATER_RUN: later}
        utility = checkpoint_risk = collapse = 0
        risk_ids: list[str] = []
        for variant in RunVariant:
            for checkpoint in checkpoints:
                four = settle_offline(checkpoint, Decimal("4"), Efficiency(Decimal("0.50")), multipliers[variant])
                eight = settle_offline(checkpoint, Decimal("8"), Efficiency(Decimal("0.50")), multipliers[variant])
                utility += "meaningful_investment" in four.affordable_ids
                checkpoint_risk += eight.checkpoint_skip_risk
                collapse += eight.one_login_run_collapse_risk
                if eight.checkpoint_skip_risk:
                    risk_ids.append(f"{variant.value}×{checkpoint.checkpoint.value}")
        analyses.append(SensitivityResult(gate_hours, second, later, utility, checkpoint_risk, collapse, tuple(risk_ids), _band(utility, checkpoint_risk, collapse)))
    return tuple(analyses)


def render_sensitivity_markdown(assumptions_id: str, analyses: tuple[SensitivityResult, ...]) -> str:
    lines = ["# MVP-2B 50% 候选敏感性分析", "", "仅用于寻找进入真实资源曲线验证的可行区；不代表最终效率或生产数值。", "", f"假设集：`{assumptions_id}`", "", "| gate(h) | second | later | 4h 有效投入 | 8h 卡点覆盖 | 8h 整轮风险 | 分带 |", "|---:|---:|---:|---:|---:|---:|---|"]
    for item in analyses:
        lines.append(f"| {item.gate_hours} | {item.second_multiplier} | {item.later_multiplier} | {item.four_hour_investment_cells}/12 | {item.eight_hour_checkpoint_risk_cells}/12 | {item.eight_hour_collapse_risk_cells}/12 | {item.band.value} |")
    feasible = tuple(item for item in analyses if item.band is AcceptanceBand.FEASIBLE)
    lines.extend(("", f"可进入真实资源验证：{len(feasible)}/{len(analyses)} 组。"))
    return "\n".join(lines) + "\n"
