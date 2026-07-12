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
    neili: Decimal
    silver: Decimal
    yueli: Decimal


@dataclass(frozen=True, slots=True)
class GateEvaluation:
    efficiency: Decimal
    meaningful_4h: bool
    full_preparation_8h: bool
    anti_collapse_8h: bool
    day1_forecast: bool
    day3_forecast: bool
    combat_matrix: bool


@dataclass(frozen=True, slots=True)
class AttainmentEvaluation:
    route_snapshots: tuple[RouteSnapshot, ...]
    gates: tuple[GateEvaluation, ...]
    recommendation: str
    evidence: str


def evaluate_attainment() -> AttainmentEvaluation:
    snapshots: list[RouteSnapshot] = []
    gates: list[GateEvaluation] = []
    for efficiency in EFFICIENCIES:
        route_rows: list[RouteSnapshot] = []
        for route in ROUTES:
            balances = {"neili": Decimal(0), "silver": Decimal(0), "yueli": Decimal(0)}
            for event in build_timeline(route, efficiency):
                if event.kind is EventKind.SNAPSHOT:
                    route_rows.append(RouteSnapshot(route, event.checkpoint, efficiency, balances["neili"], balances["silver"], balances["yueli"]))
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
        gates.append(GateEvaluation(efficiency, offline_4h >= Decimal(2952), offline_8h < Decimal(50952), offline_8h < Decimal(112132), boss4.neili >= Decimal(50952), boss5.neili >= Decimal(112132), combat_complete))
    return AttainmentEvaluation(tuple(snapshots), tuple(gates), "no_recommendation", "evidence_forecast")


def render_attainment_json() -> str:
    result = evaluate_attainment()
    return json.dumps({
        "recommendation": result.recommendation,
        "evidence": result.evidence,
        "gates": [{**asdict(row), "efficiency": str(row.efficiency)} for row in result.gates],
        "route_snapshots": [{**asdict(row), "efficiency": str(row.efficiency), "neili": str(row.neili), "silver": str(row.silver), "yueli": str(row.yueli)} for row in result.route_snapshots],
    }, ensure_ascii=False, indent=2) + "\n"


def render_attainment_markdown() -> str:
    result = evaluate_attainment()
    lines = ["# MVP-2 达成预测评估", "", "证据等级：`evidence_forecast`；不得解释为实测达成。", "", "| 效率 | 4h 有意义投入 | 8h 防完整准备直越 | 8h 防整轮坍缩 | Day1 | Day3 | 战斗 |", "|---:|---|---|---|---|---|---|"]
    lines.extend(f"| {row.efficiency} | {row.meaningful_4h} | {row.full_preparation_8h} | {row.anti_collapse_8h} | {row.day1_forecast} | {row.day3_forecast} | {row.combat_matrix} |" for row in result.gates)
    lines.extend(("", "**结论：no_recommendation（evidence_forecast）**"))
    return "\n".join(lines) + "\n"
