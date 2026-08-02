from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from offline_sim import EFFICIENCIES, ScenarioResult


@dataclass(frozen=True, slots=True)
class EfficiencySummary:
    efficiency: Decimal
    evaluated_cells: int
    four_hour_investment_cells: int
    eight_hour_checkpoint_risk_cells: int
    eight_hour_collapse_risk_cells: int


def summarize_efficiencies(results: tuple[ScenarioResult, ...]) -> tuple[EfficiencySummary, ...]:
    summaries: list[EfficiencySummary] = []
    for efficiency in EFFICIENCIES:
        selected = tuple(result for result in results if result.efficiency == efficiency)
        four_hour = tuple(result for result in selected if result.requested_hours == Decimal("4"))
        eight_hour = tuple(result for result in selected if result.requested_hours == Decimal("8"))
        summaries.append(EfficiencySummary(
            efficiency=efficiency,
            evaluated_cells=len(four_hour),
            four_hour_investment_cells=sum("meaningful_investment" in result.affordable_ids for result in four_hour),
            eight_hour_checkpoint_risk_cells=sum(result.checkpoint_skip_risk for result in eight_hour),
            eight_hour_collapse_risk_cells=sum(result.one_login_run_collapse_risk for result in eight_hour),
        ))
    return tuple(summaries)


def render_summary_markdown(assumptions_id: str, summaries: tuple[EfficiencySummary, ...]) -> str:
    lines = [
        "# MVP-2B 离线效率汇总（暂定输入）", "",
        "仅供候选比较；不代表最终数值，也不选择最终效率。", "",
        f"假设集：`{assumptions_id}`", "",
        "| 效率 | 4h 支持有效投入 | 8h 卡点准备一次覆盖 | 8h 整轮压缩风险 |",
        "|---:|---:|---:|---:|",
    ]
    for summary in summaries:
        total = summary.evaluated_cells
        lines.append(f"| {summary.efficiency} | {summary.four_hour_investment_cells}/{total} | {summary.eight_hour_checkpoint_risk_cells}/{total} | {summary.eight_hour_collapse_risk_cells}/{total} |")
    return "\n".join(lines) + "\n"
