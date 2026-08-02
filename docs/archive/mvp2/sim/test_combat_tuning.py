from __future__ import annotations

from combat_tuning import (
    BOSS_SPECS,
    REALMS,
    ROUTES,
    Adjustment,
    EnemyStats,
    RealmStats,
    build_matrix,
    derive_next_realm,
    search_bosses,
)


def test_realm_six_and_seven_are_mechanically_derived_with_half_up_rounding() -> None:
    # Given
    realm_five = RealmStats(5, 840, 84, 44, 148, 22, 21_000, 10)

    # When
    realm_six = derive_next_realm(realm_five, 48_000, 10)
    realm_seven = derive_next_realm(realm_six, 108_000, 10)

    # Then
    assert realm_six == RealmStats(6, 1680, 168, 88, 160, 25, 48_000, 10)
    assert realm_seven == RealmStats(7, 3360, 336, 176, 172, 28, 108_000, 10)
    assert REALMS[6] == realm_six
    assert REALMS[7] == realm_seven


def test_deterministic_search_reproduces_persisted_bosses() -> None:
    # Given
    expected = {
        4: EnemyStats(3024, 470, 422, 160, 25, ("high_defense", "high_attack")),
        5: EnemyStats(5376, 504, 722, 172, 28, ("high_attack", "cleanse", "high_defense")),
    }

    # When
    selected = search_bosses()

    # Then
    assert BOSS_SPECS == expected
    assert selected == expected


def test_all_routes_lose_baseline_and_each_has_a_single_adjustment_pass() -> None:
    # Given / When
    rows = build_matrix()

    # Then
    for boss in (4, 5):
        boss_rows = tuple(row for row in rows if row.boss == boss)
        assert {row.route for row in boss_rows} == set(ROUTES)
        assert all(row.baseline.win is False for row in boss_rows)
        assert all(row.has_passing_combat_adjustment for row in boss_rows)
        assert any(row.martial_upgrade.result is not None and row.martial_upgrade.result.win for row in boss_rows)


def test_matrix_matches_route_keyed_expected_adjustments() -> None:
    # Given / When
    rows = {(row.boss, row.route): row for row in build_matrix()}

    # Then
    expected = {
        (4, "huashan"): (False, False, True, True),
        (4, "shaolin"): (False, True, False, False),
        (4, "tangmen"): (False, False, True, True),
        (5, "huashan"): (False, False, True, True),
        (5, "shaolin"): (False, True, True, False),
        (5, "tangmen"): (False, True, True, False),
    }
    assert set(rows) == set(expected)
    for key, (baseline, martial, route_switch, switch_required) in expected.items():
        row = rows[key]
        assert row.baseline.win is baseline
        assert row.martial_upgrade.result is not None
        assert row.martial_upgrade.result.win is martial
        assert row.route_switch.result is not None
        assert row.route_switch.result.win is route_switch
        assert row.route_switch_required is switch_required
        assert row.has_passing_combat_adjustment is True


def test_zhoutian_is_resource_progress_only_and_route_switch_is_not_required() -> None:
    # Given / When
    rows = build_matrix()

    # Then
    assert all(row.zhoutian.adjustment is Adjustment.ZHOUTIAN_SEGMENT for row in rows)
    assert all(row.zhoutian.available is True and row.zhoutian.result is None for row in rows)
    assert all(row.route_switch.available is True for row in rows)
    assert all(row.route_switch_required is False for row in rows if row.martial_upgrade.result is not None and row.martial_upgrade.result.win)
