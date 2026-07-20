from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR
from typing import Final

EFFICIENCIES: Final = (Decimal("0.35"), Decimal("0.50"), Decimal("0.65"))
MARTIAL_COSTS: Final = {
    "before_boss_2": Decimal("1506"),
    "before_boss_3": Decimal("2108"),
    "before_boss_4": Decimal("2952"),
    "before_boss_5": Decimal("4132"),
}


def calibrate_base_hourly_rate(target_cost: Decimal, hours: Decimal, efficiency: Decimal) -> Decimal:
    """Derive the pre-efficiency hourly rate from one declared calibration anchor."""
    return target_cost / hours / efficiency


BASE_HOURLY_NEILI: Final = calibrate_base_hourly_rate(
    MARTIAL_COSTS["before_boss_5"], Decimal("4"), Decimal("0.50")
)


@dataclass(frozen=True, slots=True)
class EfficiencyComparison:
    efficiency: Decimal
    effective_hourly_neili: Decimal
    earned_4h: Decimal
    earned_8h: Decimal
    lv10_martial_anchor_gate: bool
    full_preparation_safe_gate: bool


@dataclass(frozen=True, slots=True)
class Recommendation:
    outcome: str
    reason: str
    tier: Decimal | None


def offline_neili(hours: Decimal, efficiency: Decimal) -> Decimal:
    """Apply efficiency exactly once, then floor the settlement to whole neili."""
    effective_hours = min(hours, Decimal("8"))
    return (BASE_HOURLY_NEILI * effective_hours * efficiency).quantize(Decimal("1"), rounding=ROUND_FLOOR)


def compare_efficiencies() -> tuple[EfficiencyComparison, ...]:
    """Compare tiers against the strictest frozen one-upgrade target."""
    target = max(MARTIAL_COSTS.values())
    return tuple(
        EfficiencyComparison(
            efficiency=efficiency,
            effective_hourly_neili=BASE_HOURLY_NEILI * efficiency,
            earned_4h=offline_neili(Decimal("4"), efficiency),
            earned_8h=offline_neili(Decimal("8"), efficiency),
            lv10_martial_anchor_gate=offline_neili(Decimal("4"), efficiency) >= target,
            full_preparation_safe_gate=offline_neili(Decimal("8"), efficiency) < Decimal("50952"),
        )
        for efficiency in EFFICIENCIES
    )


def derive_recommendation(evidence_complete: bool, qualifying_tiers: tuple[Decimal, ...]) -> Recommendation:
    """Recommend only when complete evidence leaves exactly one qualifying tier."""
    if not evidence_complete:
        return Recommendation("no_recommendation", "evidence_incomplete", None)
    if len(qualifying_tiers) == 1:
        return Recommendation("recommendation", "unique_qualifying_tier", qualifying_tiers[0])
    if qualifying_tiers:
        return Recommendation("no_recommendation", "multiple_qualifying_tiers", None)
    return Recommendation("no_recommendation", "no_qualifying_tier", None)
