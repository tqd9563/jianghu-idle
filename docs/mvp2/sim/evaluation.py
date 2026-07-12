from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Final

from attainment_timeline import EventKind, build_timeline
from combat_tuning import build_matrix

ROUTES: Final = ("huashan", "shaolin", "tangmen")
EFFICIENCIES: Final = (Decimal("0.35"), Decimal("0.50"), Decimal("0.65"))


@dataclass(frozen=True, slots=True)
class RouteSnapshot:
    route: str
    checkpoint: str
    efficiency: Decimal
    neili: Decimal | None
    silver: Decimal | None
    yueli: Decimal | None
    available: bool


@dataclass(frozen=True, slots=True)
class GateEvaluation:
    efficiency: Decimal
    meaningful_4h: bool
    boss4_full_preparation_8h_safe: bool
    boss5_full_preparation_8h_safe: bool
    day1_forecast: bool
    day3_forecast: bool
    combat_matrix: bool


@dataclass(frozen=True, slots=True)
class AttainmentEvaluation:
    route_snapshots: tuple[RouteSnapshot, ...]
    gates: tuple[GateEvaluation, ...]
    recommendation: str
    evidence: str
    qualifying_tiers: tuple[Decimal, ...]
    recommended_efficiency: Decimal | None
    production_finalization: str
    open_limitations: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CandidateRecommendation:
    outcome: str
    reason: str
    tier: Decimal | None


def derive_candidate_recommendation(qualifying_tiers: tuple[Decimal, ...]) -> CandidateRecommendation:
    if qualifying_tiers:
        return CandidateRecommendation("candidate_recommendation", "lowest_qualifying_efficiency", min(qualifying_tiers))
    return CandidateRecommendation("no_recommendation", "no_qualifying_tier", None)


def evaluate_attainment() -> AttainmentEvaluation:
    snapshots: list[RouteSnapshot] = []
    gates: list[GateEvaluation] = []
    for efficiency in EFFICIENCIES:
        route_rows: list[RouteSnapshot] = []
        for route in ROUTES:
            balances = {"neili": Decimal(0), "silver": Decimal(0), "yueli": Decimal(0)}
            progression_available = True
            for event in build_timeline(route, efficiency):
                if event.kind is EventKind.SNAPSHOT:
                    available = progression_available or event.checkpoint == "before_boss_4"
                    route_rows.append(RouteSnapshot(route, event.checkpoint, efficiency, balances["neili"] if available else None, balances["silver"] if available else None, balances["yueli"] if available else None, available))
                    continue
                if event.kind is EventKind.SPEND and balances["neili"] < -event.neili:
                    progression_available = False
                    continue
                if not progression_available:
                    continue
                balances["neili"] += event.neili
                balances["silver"] += event.silver
                balances["yueli"] += event.yueli
        snapshots.extend(route_rows)
        boss4 = next(row for row in route_rows if row.checkpoint == "before_boss_4")
        boss5 = next(row for row in route_rows if row.checkpoint == "before_boss_5")
        offline_4h = Decimal(2066) * Decimal(4) * efficiency
        offline_8h = Decimal(2066) * Decimal(8) * efficiency
        combat_complete = all(row.has_passing_combat_adjustment for row in build_matrix())
        gates.append(GateEvaluation(efficiency, offline_4h >= Decimal(2952), offline_8h < Decimal(50952), offline_8h < Decimal(112132), boss4.neili is not None and boss4.neili >= Decimal(50952), boss5.neili is not None and boss5.neili >= Decimal(112132), combat_complete))
    qualifying = tuple(row.efficiency for row in gates if all((row.meaningful_4h, row.boss4_full_preparation_8h_safe, row.boss5_full_preparation_8h_safe, row.day1_forecast, row.day3_forecast, row.combat_matrix)))
    recommendation = derive_candidate_recommendation(qualifying)
    return AttainmentEvaluation(tuple(snapshots), tuple(gates), recommendation.outcome, "evidence_forecast", qualifying, recommendation.tier, "requires_observed_natural_window_playtest", ("whole_run_collapse_unverified_missing_remaining_run_threshold",))


def render_attainment_json() -> str:
    result = evaluate_attainment()
    return json.dumps({
        "recommendation": result.recommendation,
        "recommended_efficiency": str(result.recommended_efficiency) if result.recommended_efficiency is not None else None,
        "qualifying_tiers": [str(tier) for tier in result.qualifying_tiers],
        "evidence": result.evidence,
        "production_finalization": result.production_finalization,
        "open_limitations": list(result.open_limitations),
        "gates": [{**asdict(row), "efficiency": str(row.efficiency)} for row in result.gates],
        "route_snapshots": [{**asdict(row), "efficiency": str(row.efficiency), "neili": str(row.neili) if row.neili is not None else None, "silver": str(row.silver) if row.silver is not None else None, "yueli": str(row.yueli) if row.yueli is not None else None} for row in result.route_snapshots],
    }, ensure_ascii=False, indent=2) + "\n"


def render_attainment_markdown() -> str:
    result = evaluate_attainment()
    lines = ["# MVP-2 达成预测评估", "", "证据等级：`evidence_forecast`；不得解释为实测达成。", "", "| 效率 | 4h 有意义投入 | Boss4 8h 防直越 | Boss5 8h 防直越 | Day1 | Day3 | 战斗 |", "|---:|---|---|---|---|---|---|"]
    lines.extend(f"| {row.efficiency} | {row.meaningful_4h} | {row.boss4_full_preparation_8h_safe} | {row.boss5_full_preparation_8h_safe} | {row.day1_forecast} | {row.day3_forecast} | {row.combat_matrix} |" for row in result.gates)
    lines.extend(("", f"**结论：{result.recommendation} / {result.recommended_efficiency}（evidence_forecast）**", "", "整轮坍缩尚未验证：缺少 remaining-run threshold。生产最终定档前仍须完成自然窗口实测 playtest。"))
    return "\n".join(lines) + "\n"
