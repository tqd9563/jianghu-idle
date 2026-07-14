from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum
from itertools import product
from typing import Final

DEF_K: Final = 100.0
HIT_FLOOR: Final = 0.30
ROUND_CAP: Final = 50
ROUTES: Final = ("huashan", "shaolin", "tangmen")


class Adjustment(StrEnum):
    ZHOUTIAN_SEGMENT = "zhoutian_segment"
    MARTIAL_UPGRADE = "martial_upgrade"
    ROUTE_SWITCH = "route_switch"


@dataclass(frozen=True, slots=True)
class RealmStats:
    realm: int
    hp: int
    atk: int
    defense: int
    hit: int
    dodge: int
    cost: int
    skill_cap: int


@dataclass(frozen=True, slots=True)
class EnemyStats:
    hp: int
    atk: int
    defense: int
    hit: int
    dodge: int
    tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Build:
    hp: float
    atk: float
    defense: float
    hit: int
    dodge: int
    crit: float
    crit_damage: float
    first_crit: bool
    shield: float
    thorns: float
    poison_initial: float
    poison_per_hit: float
    poison_coefficient: float
    poison_cap: float
    poison_burst: float
    sword_qi_need: float
    burst_multiplier: float
    low_hp_reduction: float
    plain_multiplier: float


@dataclass(frozen=True, slots=True)
class FightResult:
    win: bool
    rounds: int
    hp_ratio: float


@dataclass(frozen=True, slots=True)
class AdjustmentResult:
    adjustment: Adjustment
    available: bool
    result: FightResult | None


@dataclass(frozen=True, slots=True)
class MatrixRow:
    boss: int
    route: str
    baseline: FightResult
    zhoutian: AdjustmentResult
    martial_upgrade: AdjustmentResult
    route_switch: AdjustmentResult
    route_switch_required: bool

    @property
    def has_passing_combat_adjustment(self) -> bool:
        martial_pass = self.martial_upgrade.result is not None and self.martial_upgrade.result.win
        switch_pass = self.route_switch.result is not None and self.route_switch.result.win
        return martial_pass or switch_pass


def _round_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def derive_next_realm(previous: RealmStats, cost: int, skill_cap: int) -> RealmStats:
    return RealmStats(
        previous.realm + 1,
        _round_half_up(Decimal(previous.hp) * Decimal("2.0")),
        _round_half_up(Decimal(previous.atk) * Decimal("2.0")),
        _round_half_up(Decimal(previous.defense) * Decimal("2.0")),
        previous.hit + 12,
        previous.dodge + 3,
        cost,
        skill_cap,
    )


REALM_FIVE: Final = RealmStats(5, 840, 84, 44, 148, 22, 21_000, 10)
REALM_SIX: Final = derive_next_realm(REALM_FIVE, 48_000, 10)
REALM_SEVEN: Final = derive_next_realm(REALM_SIX, 108_000, 10)
REALMS: Final = {5: REALM_FIVE, 6: REALM_SIX, 7: REALM_SEVEN}


def make_build(route: str, realm: int, level: int) -> Build:
    base = REALMS[realm]
    if route == "huashan":
        return Build(base.hp, base.atk * (1 + 0.06 * level), base.defense, base.hit, base.dodge,
                     min(0.15 + 0.025 * level, 0.80), 1.70 + 0.08 * level, True, 0, 0,
                     0, 0, 0, 0, 0, 3, 5.5, 0, 1)
    elif route == "shaolin":
        return Build(base.hp * (1 + 0.06 * level), base.atk, base.defense * (1.20 + 0.06 * level),
                     base.hit, base.dodge, 0.05, 1.50, False, 0.45,
                     0.40 + 0.03 * level, 0, 0, 0, 0, 0, 99, 0, 0.30, 1)
    elif route == "tangmen":
        return Build(base.hp, base.atk * (1 + 0.01 * level), base.defense, base.hit, base.dodge,
                     0.05, 1.50, False, 0, 0, 3, 1, 0.12 + 0.018 * level,
                     10, 0.8, 99, 0, 0, 0.60)
    else:
        raise KeyError(route)


def _hit_chance(hit: int, dodge: int) -> float:
    return max(HIT_FLOOR, min(1.0, hit / (hit + dodge)))


def fight(build: Build, enemy: EnemyStats) -> FightResult:
    player_hp, shield, enemy_hp = build.hp, build.hp * build.shield, float(enemy.hp)
    poison_layers = sword_qi = 0.0
    player_hit = _hit_chance(build.hit, enemy.dodge)
    enemy_hit = _hit_chance(enemy.hit, build.dodge)
    for round_number in range(1, ROUND_CAP + 1):
        if round_number == 1:
            poison_layers = min(build.poison_cap, build.poison_initial)
        forced = round_number == 1 and build.first_crit
        critical = build.crit_damage if forced else (1 - build.crit) + build.crit * build.crit_damage
        dealt = build.atk * critical * DEF_K / (DEF_K + enemy.defense) * player_hit * build.plain_multiplier
        if build.sword_qi_need < 99:
            sword_qi += player_hit * (1.0 if forced else build.crit)
            if sword_qi >= build.sword_qi_need:
                sword_qi -= build.sword_qi_need
                dealt += build.atk * build.burst_multiplier * DEF_K / (DEF_K + enemy.defense)
        enemy_hp -= dealt
        poison_layers = min(build.poison_cap, poison_layers + player_hit * build.poison_per_hit)
        if enemy_hp <= 0:
            return FightResult(True, round_number, max(player_hp, 0) / build.hp)
        incoming = enemy.atk * enemy_hit * DEF_K / (DEF_K + build.defense)
        if build.low_hp_reduction and player_hp < 0.30 * build.hp:
            incoming *= 1 - build.low_hp_reduction
        absorbed = min(shield, incoming)
        shield -= absorbed
        player_hp -= incoming - absorbed
        enemy_hp -= incoming * build.thorns
        if poison_layers > 0:
            enemy_hp -= poison_layers * build.atk * build.poison_coefficient
            if poison_layers >= build.poison_cap:
                enemy_hp -= build.poison_cap * build.atk * build.poison_burst
                poison_layers = 0
        if "cleanse" in enemy.tags and round_number % 3 == 0:
            poison_layers = 0
        if enemy_hp <= 0:
            return FightResult(True, round_number, max(player_hp, 0) / build.hp)
        if player_hp <= 0:
            return FightResult(False, round_number, 0)
    return FightResult(False, ROUND_CAP, max(player_hp, 0) / build.hp)


def _qualifies(enemy: EnemyStats, realm: int, baseline_level: int) -> bool:
    baseline = tuple(fight(make_build(route, realm, baseline_level), enemy) for route in ROUTES)
    upgraded = tuple(fight(make_build(route, realm, baseline_level + 1), enemy) for route in ROUTES)
    return all(not result.win for result in baseline) and any(result.win for result in upgraded)


def _search_one(boss: int, realm: int, baseline_level: int, tags: tuple[str, ...]) -> EnemyStats:
    base = REALMS[realm]
    for hp_scale, atk_scale, defense_scale in product(range(100, 3001, 10), range(5, 301, 5), range(20, 501, 10)):
        enemy = EnemyStats(
            _round_half_up(Decimal(base.hp) * Decimal(hp_scale) / 100),
            _round_half_up(Decimal(base.atk) * Decimal(atk_scale) / 100),
            _round_half_up(Decimal(base.defense) * Decimal(defense_scale) / 100),
            base.hit,
            base.dodge,
            tags,
        )
        if _qualifies(enemy, realm, baseline_level):
            return enemy
    raise LookupError(boss)


def search_bosses() -> dict[int, EnemyStats]:
    return {
        4: _search_one(4, 6, 8, ("high_defense", "high_attack")),
        5: _search_one(5, 7, 9, ("high_attack", "cleanse", "high_defense")),
    }


BOSS_SPECS: Final = {
    4: EnemyStats(3024, 470, 422, 160, 25, ("high_defense", "high_attack")),
    5: EnemyStats(5376, 504, 722, 172, 28, ("high_attack", "cleanse", "high_defense")),
}


def build_matrix() -> tuple[MatrixRow, ...]:
    rows: list[MatrixRow] = []
    for boss, realm, level in ((4, 6, 8), (5, 7, 9)):
        for route in ROUTES:
            baseline = fight(make_build(route, realm, level), BOSS_SPECS[boss])
            upgraded = fight(make_build(route, realm, level + 1), BOSS_SPECS[boss])
            switch_results = tuple(
                fight(make_build(other, realm, level + 1), BOSS_SPECS[boss])
                for other in ROUTES if other != route
            )
            best_switch = min(switch_results, key=lambda result: (not result.win, result.rounds))
            rows.append(MatrixRow(
                boss, route, baseline,
                AdjustmentResult(Adjustment.ZHOUTIAN_SEGMENT, True, None),
                AdjustmentResult(Adjustment.MARTIAL_UPGRADE, level < REALMS[realm].skill_cap, upgraded),
                AdjustmentResult(Adjustment.ROUTE_SWITCH, True, best_switch),
                not upgraded.win,
            ))
    return tuple(rows)


if __name__ == "__main__":
    print("=== Boss 4/5 Combat Matrix ===")
    for row in build_matrix():
        print(f"Boss {row.boss} | Route {row.route} | Baseline: {'WIN' if row.baseline.win else 'LOSE'} ({row.baseline.rounds} rounds, HP ratio {row.baseline.hp_ratio:.2%})")
        if row.martial_upgrade.result:
            print(f"  Martial +1: {'WIN' if row.martial_upgrade.result.win else 'LOSE'} ({row.martial_upgrade.result.rounds} rounds)")
        if row.route_switch.result:
            print(f"  Route Switch: {'WIN' if row.route_switch.result.win else 'LOSE'} ({row.route_switch.result.rounds} rounds)")
        print(f"  Has passing adjustment: {row.has_passing_combat_adjustment}")
        print()
