#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run offline_sim.py
# 3. Or make executable and run:
#      chmod +x offline_sim.py && ./offline_sim.py
# ──────────────────

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from decimal import Decimal, ROUND_FLOOR
from enum import StrEnum
from pathlib import Path
from typing import Final, NewType

AbsenceHours = NewType("AbsenceHours", Decimal)
Efficiency = NewType("Efficiency", Decimal)

OFFLINE_CAP_HOURS: Final = Decimal("8")
EFFICIENCIES: Final = (Decimal("0.35"), Decimal("0.50"), Decimal("0.65"))
ABSENCES: Final = (Decimal("2"), Decimal("4"), Decimal("8"))
DISCLAIMER: Final = "仅供比较；不代表最终数值，也不选择或推荐任何效率档。"


class RunVariant(StrEnum):
    FIRST_RUN = "first_run"
    SECOND_RUN = "second_run"
    LATER_RUN = "later_run"


class Checkpoint(StrEnum):
    BEFORE_BOSS_2 = "before_boss_2"
    BEFORE_BOSS_3 = "before_boss_3"
    BEFORE_BOSS_4 = "before_boss_4"
    BEFORE_BOSS_5 = "before_boss_5"


@dataclass(frozen=True, slots=True)
class ResourceBundle:
    neili: Decimal
    silver: Decimal
    experience: Decimal

    @classmethod
    def zero(cls) -> ResourceBundle:
        return cls(Decimal(0), Decimal(0), Decimal(0))

    def plus(self, other: ResourceBundle) -> ResourceBundle:
        return ResourceBundle(self.neili + other.neili, self.silver + other.silver, self.experience + other.experience)

    def scaled_floor(self, multiplier: Decimal) -> ResourceBundle:
        return ResourceBundle(*(_floor(value * multiplier) for value in (self.neili, self.silver, self.experience)))

    def covers(self, cost: ResourceBundle) -> bool:
        return self.neili >= cost.neili and self.silver >= cost.silver and self.experience >= cost.experience


@dataclass(frozen=True, slots=True)
class Investment:
    investment_id: str
    cost: ResourceBundle


@dataclass(frozen=True, slots=True)
class CheckpointAssumptions:
    checkpoint: Checkpoint
    hourly_rate: ResourceBundle
    bank: ResourceBundle
    investments: tuple[Investment, ...]
    checkpoint_gate_ids: tuple[str, ...]
    remaining_run_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class SettlementResult:
    requested_hours: Decimal
    effective_hours: Decimal
    efficiency: Decimal
    earned: ResourceBundle
    available: ResourceBundle
    affordable_ids: tuple[str, ...]
    checkpoint_skip_risk: bool
    one_login_run_collapse_risk: bool


@dataclass(frozen=True, slots=True)
class ScenarioResult:
    run_variant: RunVariant
    checkpoint: Checkpoint
    requested_hours: Decimal
    effective_hours: Decimal
    efficiency: Decimal
    earned: ResourceBundle
    available: ResourceBundle
    affordable_ids: tuple[str, ...]
    checkpoint_skip_risk: bool
    one_login_run_collapse_risk: bool

    @classmethod
    def synthetic(cls, efficiency: Decimal) -> ScenarioResult:
        return cls(RunVariant.FIRST_RUN, Checkpoint.BEFORE_BOSS_2, Decimal(2), Decimal(2), efficiency, ResourceBundle.zero(), ResourceBundle.zero(), (), False, False)


@dataclass(frozen=True, slots=True)
class ScenarioGrid:
    checkpoints: tuple[CheckpointAssumptions, ...]
    run_multipliers: dict[RunVariant, Decimal]


def _floor(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_FLOOR)


def settle_offline(assumptions: CheckpointAssumptions, absence: AbsenceHours, efficiency: Efficiency, growth: Decimal) -> SettlementResult:
    effective = min(Decimal(absence), OFFLINE_CAP_HOURS)
    earned = assumptions.hourly_rate.scaled_floor(effective * Decimal(efficiency) * growth)
    available = assumptions.bank.plus(earned)
    affordable = tuple(item.investment_id for item in assumptions.investments if available.covers(item.cost))
    return SettlementResult(
        requested_hours=Decimal(absence), effective_hours=effective, efficiency=Decimal(efficiency), earned=earned, available=available,
        affordable_ids=affordable,
        checkpoint_skip_risk=all(item_id in affordable for item_id in assumptions.checkpoint_gate_ids),
        one_login_run_collapse_risk=all(item_id in affordable for item_id in assumptions.remaining_run_ids),
    )


def evaluate_grid(grid: ScenarioGrid) -> tuple[ScenarioResult, ...]:
    results: list[ScenarioResult] = []
    for variant in RunVariant:
        growth = grid.run_multipliers[variant]
        for assumptions in grid.checkpoints:
            for efficiency in EFFICIENCIES:
                for absence in ABSENCES:
                    settled = settle_offline(assumptions, AbsenceHours(absence), Efficiency(efficiency), growth)
                    results.append(ScenarioResult(variant, assumptions.checkpoint, settled.requested_hours, settled.effective_hours, settled.efficiency, settled.earned, settled.available, settled.affordable_ids, settled.checkpoint_skip_risk, settled.one_login_run_collapse_risk))
    return tuple(results)


def render_markdown(assumptions_id: str, results: tuple[ScenarioResult, ...]) -> str:
    lines = ["# MVP-2B 离线效率对照（暂定输入）", "", DISCLAIMER, "", f"假设集：`{assumptions_id}`", "", "| 轮次 | 卡点 | 离线时长 | 有效时长 | 效率 | 离线新增 | 可用总量 | 可承担投入 | 卡点准备一次覆盖 | 单次登录压缩整轮风险 |", "|---|---|---:|---:|---:|---|---|---|---|---|"]
    for result in results:
        earned = f"内力 {result.earned.neili} / 银两 {result.earned.silver} / 阅历 {result.earned.experience}"
        available = f"内力 {result.available.neili} / 银两 {result.available.silver} / 阅历 {result.available.experience}"
        lines.append(f"| {result.run_variant.value} | {result.checkpoint.value} | {result.requested_hours}h | {result.effective_hours}h | {result.efficiency} | {earned} | {available} | {', '.join(result.affordable_ids) or '—'} | {'是' if result.checkpoint_skip_risk else '否'} | {'是' if result.one_login_run_collapse_risk else '否'} |")
    return "\n".join(lines) + "\n"


def render_json(assumptions_id: str, results: tuple[ScenarioResult, ...]) -> str:
    rows = []
    for result in results:
        row = asdict(result)
        row["run_variant"] = result.run_variant.value
        row["checkpoint"] = result.checkpoint.value
        row["earned"] = {key: str(value) for key, value in asdict(result.earned).items()}
        row["available"] = {key: str(value) for key, value in asdict(result.available).items()}
        for key in ("requested_hours", "effective_hours", "efficiency"):
            row[key] = str(row[key])
        rows.append(row)
    return json.dumps({"assumptions_id": assumptions_id, "disclaimer": DISCLAIMER, "scenarios": rows}, ensure_ascii=False, indent=2)


def main() -> None:
    from assumptions import load_assumptions
    from real_mapping import mapping_report
    from sensitivity import analyze_sensitivity, render_sensitivity_markdown
    from summary import render_summary_markdown, summarize_efficiencies

    if "--attainment-evaluation" in sys.argv:
        from evaluation import render_attainment_json, render_attainment_markdown
        print(render_attainment_json() if "--json" in sys.argv else render_attainment_markdown(), end="")
        return
    if "--checkpoint-snapshots" in sys.argv:
        from checkpoint_snapshot import render_snapshot_json
        print(render_snapshot_json(), end="")
        return
    if "--real-evaluation" in sys.argv:
        from real_evaluation import render_real_report_json, render_real_report_markdown
        print(render_real_report_json() if "--json" in sys.argv else render_real_report_markdown(), end="")
        return

    if "--real-mapping" in sys.argv:
        print(mapping_report(), end="")
        return
    output_format = "json" if "--json" in sys.argv else "markdown"
    path = Path(sys.argv[sys.argv.index("--assumptions") + 1]) if "--assumptions" in sys.argv else Path(__file__).with_name("normalized-candidate-v0.json")
    loaded = load_assumptions(path)
    results = evaluate_grid(loaded.grid)
    if "--sensitivity" in sys.argv:
        output = render_sensitivity_markdown(loaded.assumptions_id, analyze_sensitivity(loaded.grid))
    elif "--summary" in sys.argv:
        output = render_summary_markdown(loaded.assumptions_id, summarize_efficiencies(results))
    else:
        output = render_json(loaded.assumptions_id, results) if output_format == "json" else render_markdown(loaded.assumptions_id, results)
    print(output, end="")


if __name__ == "__main__":
    main()
