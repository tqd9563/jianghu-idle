from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Final


@dataclass(frozen=True, slots=True)
class StageReward:
    """Per-stage resource reward for one source-category tier."""

    neili: Decimal
    silver: Decimal
    yueli: Decimal


@dataclass(frozen=True, slots=True)
class EventSegment:
    """Contiguous run of same-category stages before a boss checkpoint."""

    stage_start: int
    stage_end: int
    category: str
    per_stage: StageReward

    @property
    def stage_count(self) -> int:
        return self.stage_end - self.stage_start + 1

    @property
    def cumulative(self) -> StageReward:
        return StageReward(
            self.per_stage.neili * self.stage_count,
            self.per_stage.silver * self.stage_count,
            self.per_stage.yueli * self.stage_count,
        )


@dataclass(frozen=True, slots=True)
class IdleCurve:
    """Continuous idle neili production rate at a given realm."""

    realm: int
    neili_per_second: Decimal
    neili_per_hour: Decimal
    provenance: str


@dataclass(frozen=True, slots=True)
class EventCurve:
    """Cumulative event/milestone rewards from stages before a boss."""

    map_id: int
    stage_range: tuple[int, int]
    segments: tuple[EventSegment, ...]
    provenance: str

    @property
    def cumulative(self) -> StageReward:
        neili = silver = yueli = Decimal(0)
        for seg in self.segments:
            seg_cum = seg.cumulative
            neili += seg_cum.neili
            silver += seg_cum.silver
            yueli += seg_cum.yueli
        return StageReward(neili, silver, yueli)


@dataclass(frozen=True, slots=True)
class CheckpointResourceBaseline:
    checkpoint: str
    previous_state: str
    target_state: str
    realm_neili: Decimal
    martial_neili: Decimal
    adjustment_silver: Decimal
    yueli_liquidity: str
    yueli_net_cost: Decimal
    remaining_neili: Decimal
    remaining_silver_reserve: Decimal
    remaining_online_requirements: tuple[str, ...]
    provenance: tuple[str, ...]

    @property
    def full_preparation_neili(self) -> Decimal:
        return self.realm_neili + self.martial_neili


BOSS_2_BASELINE: Final = CheckpointResourceBaseline(
    checkpoint="before_boss_2", previous_state="r3l6", target_state="r4l7",
    realm_neili=Decimal("10000"), martial_neili=Decimal("1506"), adjustment_silver=Decimal("200"),
    yueli_liquidity="minimum_refundable_40", yueli_net_cost=Decimal("0"),
    remaining_neili=Decimal("23108"), remaining_silver_reserve=Decimal("200"),
    remaining_online_requirements=("prepare_boss_3", "defeat_boss_3", "confirm_retirement"),
    provenance=("docs/mvp0/content.md §1/§3/§4", "docs/mvp0/formulas.md §3.3/§3.4/§3.6/附录A"),
)

BOSS_3_BASELINE: Final = CheckpointResourceBaseline(
    checkpoint="before_boss_3", previous_state="r4l7", target_state="r5l8",
    realm_neili=Decimal("21000"), martial_neili=Decimal("2108"), adjustment_silver=Decimal("200"),
    yueli_liquidity="current_refundable_nodes", yueli_net_cost=Decimal("0"),
    remaining_neili=Decimal("0"), remaining_silver_reserve=Decimal("0"),
    remaining_online_requirements=("defeat_boss_3", "confirm_retirement"),
    provenance=("docs/mvp0/content.md §1/§2/§3/§4", "docs/mvp0/formulas.md §2/§3.3/§3.4/§3.6/附录A"),
)

BOSS_4_BASELINE: Final = CheckpointResourceBaseline(
    "before_boss_4", "r5l8", "r6l9", Decimal("48000"), Decimal("2952"),
    Decimal("200"), "current_refundable_nodes", Decimal(0), Decimal("112132"),
    Decimal(0), ("defeat_boss_4",), ("docs/mvp2/content.md §8",),
)
BOSS_5_BASELINE: Final = CheckpointResourceBaseline(
    "before_boss_5", "r6l9", "r7l10", Decimal("108000"), Decimal("4132"),
    Decimal("200"), "current_refundable_nodes", Decimal(0), Decimal(0),
    Decimal(0), ("defeat_boss_5",), ("docs/mvp2/content.md §8",),
)

# ── Idle curves: 9 × 1.25^(realm−1) neili/s (content.md §1) ──

BOSS_2_IDLE_CURVE: Final = IdleCurve(
    realm=3,
    neili_per_second=Decimal("14.0625"),
    neili_per_hour=Decimal("50625"),
    provenance="docs/mvp0/content.md §1 (9*1.25^(realm-1)/s, realm 3)",
)

BOSS_3_IDLE_CURVE: Final = IdleCurve(
    realm=4,
    neili_per_second=Decimal("17.578125"),
    neili_per_hour=Decimal("63281.25"),
    provenance="docs/mvp0/content.md §1 (9*1.25^(realm-1)/s, realm 4)",
)

# ── Event curves: map stages 1-9 (boss @stage 10 excluded) ──

_NORMAL_MAP2: Final = StageReward(Decimal("150"), Decimal("20"), Decimal("5"))
_ELITE_MAP2: Final = StageReward(Decimal("300"), Decimal("40"), Decimal("10"))
_NORMAL_MAP3: Final = StageReward(Decimal("300"), Decimal("30"), Decimal("8"))
_ELITE_MAP3: Final = StageReward(Decimal("500"), Decimal("60"), Decimal("15"))

BOSS_2_EVENT_CURVE: Final = EventCurve(
    map_id=2,
    stage_range=(1, 9),
    segments=(
        EventSegment(1, 3, "normal", _NORMAL_MAP2),
        EventSegment(4, 4, "elite", _ELITE_MAP2),
        EventSegment(5, 6, "normal", _NORMAL_MAP2),
        EventSegment(7, 7, "elite", _ELITE_MAP2),
        EventSegment(8, 9, "normal", _NORMAL_MAP2),
    ),
    provenance="docs/mvp0/content.md §2 map 2 stages 1-9 (Boss 2 @stage 10 excluded)",
)

BOSS_3_EVENT_CURVE: Final = EventCurve(
    map_id=3,
    stage_range=(1, 9),
    segments=(
        EventSegment(1, 2, "normal", _NORMAL_MAP3),
        EventSegment(3, 3, "elite", _ELITE_MAP3),
        EventSegment(4, 4, "normal", _NORMAL_MAP3),
        EventSegment(5, 5, "elite", _ELITE_MAP3),
        EventSegment(6, 6, "normal", _NORMAL_MAP3),
        EventSegment(7, 7, "elite", _ELITE_MAP3),
        EventSegment(8, 9, "normal", _NORMAL_MAP3),
    ),
    provenance="docs/mvp0/content.md §2 map 3 stages 1-9 (Boss 3 @stage 10 excluded)",
)


def local_idle_hours(baseline: CheckpointResourceBaseline, idle: IdleCurve) -> Decimal:
    """Neili-only comparison; does not account for silver/yueli event gating."""
    return baseline.full_preparation_neili / idle.neili_per_hour


def mapping_report() -> str:
    lines = [
        "# MVP-2B 真实资源映射状态",
        "",
        "## 基线",
        "",
        "| 卡点 | 状态 | 完整准备内力 | 调整银两 | 剩余内力 |",
        "|---|---|---:|---:|---:|",
    ]
    for baseline in (BOSS_2_BASELINE, BOSS_3_BASELINE):
        lines.append(
            f"| {baseline.checkpoint} | audited_mvp0_baseline"
            f" | {baseline.full_preparation_neili}"
            f" | {baseline.adjustment_silver}"
            f" | {baseline.remaining_neili} |"
        )
    lines.extend((
        "",
        "## Boss 4 / Boss 5 结构映射",
        "",
        "| 卡点 | 状态 | 转换 | 已知武学 | 完整准备 | 调整银两 | 剩余需求 |",
        "|---|---|---|---:|---|---:|---|",
        "| Boss 4 | authoritative | r5l8 → r6l9（首战 r6l8） | 2952 | 50952 | 200（可选、非累计） | 112132 |",
        "| Boss 5 | authoritative | r6l9 → r7l10（首战 r7l9） | 4132 | 112132 | 200（可选、非累计） | 0 |",
        "",
        "> Boss 4/5 战斗与完整准备已定；事件奖励、bank 与主动产出仍是开放输入。",
    ))
    lines.extend((
        "",
        "## 当地资源来源曲线（Boss 2 / Boss 3）",
        "",
        "| 卡点 | 闲置境界 | 闲置内力/秒 | 闲置内力/小时 | 闲置小时(仅内力) | 事件内力 | 事件银两 | 事件阅历 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ))
    for baseline, idle, event in (
        (BOSS_2_BASELINE, BOSS_2_IDLE_CURVE, BOSS_2_EVENT_CURVE),
        (BOSS_3_BASELINE, BOSS_3_IDLE_CURVE, BOSS_3_EVENT_CURVE),
    ):
        cum = event.cumulative
        hours = local_idle_hours(baseline, idle)
        lines.append(
            f"| {baseline.checkpoint} | {idle.realm}"
            f" | {idle.neili_per_second} | {idle.neili_per_hour}"
            f" | {hours} | {cum.neili} | {cum.silver} | {cum.yueli} |"
        )
    lines.extend((
        "",
        "> 闲置小时 = 完整准备内力 ÷ 闲置内力/小时，仅比较内力单一资源；"
        "银两/阅历由事件/流动性门控，不构成完整就绪判定。",
        "> 事件奖励 = 地图 stages 1-9（不含 Boss 关）首通累计；"
        "段按来源类别（普通/精英）切分，累计由段机械推导。",
    ))
    return "\n".join(lines) + "\n"
