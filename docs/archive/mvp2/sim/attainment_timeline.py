from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR
from enum import StrEnum
from typing import Final

from attainment_inputs import load_forecast
from map_rewards import MAP_REWARDS

FORECAST: Final = load_forecast()
ACTIVE_HOURLY_NEILI: Final = FORECAST.active_neili_per_hour


class EventKind(StrEnum):
    ACTIVE = "active"
    OFFLINE = "offline"
    FIRST_CLEAR = "first_clear"
    SPEND = "spend"
    SNAPSHOT = "snapshot"
    BOSS_REWARD = "boss_reward"


@dataclass(frozen=True, slots=True)
class TimelineEvent:
    source_id: str
    wall_clock_hour: Decimal
    kind: EventKind
    checkpoint: str
    neili: Decimal
    silver: Decimal
    yueli: Decimal


def _floor(value: Decimal) -> Decimal:
    return value.quantize(Decimal(1), rounding=ROUND_FLOOR)


def build_timeline(route: str, efficiency: Decimal) -> tuple[TimelineEvent, ...]:
    map_four, map_five = MAP_REWARDS
    day1, day3 = FORECAST.milestones
    active_day1 = _floor(FORECAST.active_rate_numerator * day1.cumulative_active_hours / FORECAST.active_rate_denominator_hours)
    active_day3_total = _floor(FORECAST.active_rate_numerator * day3.cumulative_active_hours / FORECAST.active_rate_denominator_hours)
    active_later = active_day3_total - active_day1
    offline_day1 = day1.cumulative_offline_blocks * FORECAST.offline_block_cap_hours
    offline_later = (day3.cumulative_offline_blocks - day1.cumulative_offline_blocks) * FORECAST.offline_block_cap_hours
    return (
        TimelineEvent(f"{route}.map4.first_clear", Decimal("20"), EventKind.FIRST_CLEAR, "before_boss_4", Decimal(map_four.pre_boss_total.neili), Decimal(map_four.pre_boss_total.silver), Decimal(map_four.pre_boss_total.yueli)),
        TimelineEvent(f"{route}.day1.active", day1.deadline_hour - Decimal("3.5"), EventKind.ACTIVE, "before_boss_4", active_day1, Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.day1.offline", day1.deadline_hour - Decimal("0.5"), EventKind.OFFLINE, "before_boss_4", _floor(FORECAST.offline_neili_per_hour * offline_day1 * efficiency), Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.before_boss_4.snapshot", day1.deadline_hour - Decimal("0.1"), EventKind.SNAPSHOT, "before_boss_4", Decimal(0), Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.before_boss_4.boss_reward", day1.deadline_hour, EventKind.BOSS_REWARD, "after_boss_4", FORECAST.boss_4_reward_neili, FORECAST.boss_4_reward_silver, FORECAST.boss_4_reward_yueli),
        TimelineEvent(f"{route}.boss4.spend", day1.deadline_hour + Decimal("0.1"), EventKind.SPEND, "after_boss_4", Decimal(-50952), Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.map5.first_clear", Decimal("60"), EventKind.FIRST_CLEAR, "before_boss_5", Decimal(map_five.pre_boss_total.neili), Decimal(map_five.pre_boss_total.silver), Decimal(map_five.pre_boss_total.yueli)),
        TimelineEvent(f"{route}.day3.active", day3.deadline_hour - Decimal("4"), EventKind.ACTIVE, "before_boss_5", active_later, Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.day3.offline", day3.deadline_hour - Decimal("0.5"), EventKind.OFFLINE, "before_boss_5", _floor(FORECAST.offline_neili_per_hour * offline_later * efficiency), Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.before_boss_5.snapshot", day3.deadline_hour - Decimal("0.1"), EventKind.SNAPSHOT, "before_boss_5", Decimal(0), Decimal(0), Decimal(0)),
        TimelineEvent(f"{route}.before_boss_5.boss_reward", day3.deadline_hour, EventKind.BOSS_REWARD, "after_boss_5", FORECAST.boss_5_reward_neili, FORECAST.boss_5_reward_silver, FORECAST.boss_5_reward_yueli),
    )


def snapshot_events(events: tuple[TimelineEvent, ...]) -> tuple[TimelineEvent, ...]:
    return tuple(event for event in events if event.kind is EventKind.SNAPSHOT)
