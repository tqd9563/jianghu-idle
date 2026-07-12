from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Final

from map_rewards import MAP_REWARDS, ResourceReward


class RewardParityError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ForecastMilestone:
    checkpoint: str
    deadline_hour: Decimal
    cumulative_active_hours: Decimal
    cumulative_offline_blocks: int


@dataclass(frozen=True, slots=True)
class AttainmentForecast:
    active_neili_per_hour: Decimal
    active_rate_numerator: Decimal
    active_rate_denominator_hours: Decimal
    offline_neili_per_hour: Decimal
    offline_block_cap_hours: Decimal
    boss_reward_neili: Decimal
    boss_reward_silver: Decimal
    boss_reward_yueli: Decimal
    milestones: tuple[ForecastMilestone, ...]
    reward_parity_validated: bool


INPUT_PATH: Final = Path(__file__).with_name("attainment-input-v1.json")


def _reward(raw: dict[str, str]) -> ResourceReward:
    return ResourceReward(int(raw["neili"]), int(raw["silver"]), int(raw["yueli"]))


def validate_reward_parity() -> None:
    with INPUT_PATH.open(encoding="utf-8") as stream:
        raw = json.load(stream)
    mirrored = tuple(raw["maps"])
    expected = tuple(
        (
            reward.map_id, reward.stages, list(reward.elite_stages), reward.boss_stage,
            reward.neili_target, reward.normal, reward.elite, reward.pre_boss_total,
        )
        for reward in MAP_REWARDS
    )
    actual = tuple(
        (
            item["map_id"], item["stages"], item["elite_stages"], item["boss_stage"],
            int(item["neili_target_14_percent"]), _reward(item["normal"]),
            _reward(item["elite"]), _reward(item["pre_boss_total"]),
        )
        for item in mirrored
    )
    if actual != expected:
        raise RewardParityError("attainment-input-v1.json rewards differ from canonical MAP_REWARDS")


def load_forecast() -> AttainmentForecast:
    validate_reward_parity()
    with INPUT_PATH.open(encoding="utf-8") as stream:
        raw = json.load(stream)
    schedule = raw["forecast_schedule"]
    boss_reward = raw["boss_rewards"]
    milestones = tuple(
        ForecastMilestone(item["checkpoint"], Decimal(item["deadline_hour"]), Decimal(item["cumulative_active_hours"]), item["cumulative_offline_blocks"])
        for item in schedule["milestones"]
    )
    return AttainmentForecast(
        Decimal(raw["active_rate_numerator"]) / Decimal(raw["active_rate_denominator_hours"]),
        Decimal(raw["active_rate_numerator"]), Decimal(raw["active_rate_denominator_hours"]), Decimal(raw["offline_base_neili_per_hour"]),
        Decimal(schedule["offline_block_cap_hours"]), Decimal(boss_reward["neili"]),
        Decimal(boss_reward["silver"]), Decimal(boss_reward["yueli"]), milestones, True,
    )
