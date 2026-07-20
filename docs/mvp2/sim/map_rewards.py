from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class ResourceReward:
    neili: int
    silver: int
    yueli: int


@dataclass(frozen=True, slots=True)
class RewardPair:
    normal: ResourceReward
    elite: ResourceReward
    total: ResourceReward


@dataclass(frozen=True, slots=True)
class MapReward:
    map_id: int
    stages: int
    elite_stages: tuple[int, ...]
    boss_stage: int
    neili_target: int
    normal: ResourceReward
    elite: ResourceReward
    pre_boss_total: ResourceReward


def _search(counts: tuple[int, int], target: int, minimum: bool) -> tuple[int, int, int]:
    normal_count, elite_count = counts
    candidates: list[tuple[tuple[int, int, int, int], int, int, int]] = []
    for normal in range(target // normal_count + 1):
        ideal = (target - normal_count * normal) // elite_count
        for elite in range(max(normal, ideal - 2), max(normal, ideal + 2) + 1):
            total = normal_count * normal + elite_count * elite
            if minimum and total < target:
                continue
            score = (total - target if minimum else abs(total - target), abs(elite - 2 * normal), normal, elite)
            candidates.append((score, normal, elite, total))
    _, normal, elite, total = min(candidates)
    return normal, elite, total


def derive_stage_rewards(normal_count: int, elite_count: int, neili_target: int, silver_minimum: int, yueli_minimum: int) -> RewardPair:
    neili_normal, neili_elite, neili_total = _search((normal_count, elite_count), neili_target, False)
    silver_normal, silver_elite, silver_total = _search((normal_count, elite_count), silver_minimum, True)
    yueli_normal, yueli_elite, yueli_total = _search((normal_count, elite_count), yueli_minimum, True)
    return RewardPair(
        ResourceReward(neili_normal, silver_normal, yueli_normal),
        ResourceReward(neili_elite, silver_elite, yueli_elite),
        ResourceReward(neili_total, silver_total, yueli_total),
    )


def _map_reward(map_id: int, elites: tuple[int, ...], target: int) -> MapReward:
    pair = derive_stage_rewards(9 - len(elites), len(elites), target, 200, 40)
    return MapReward(map_id, 10, elites, 10, target, pair.normal, pair.elite, pair.total)


MAP_REWARDS: Final = (
    _map_reward(4, (3, 6, 8), 7133),
    _map_reward(5, (2, 5, 7, 9), 15698),
)
