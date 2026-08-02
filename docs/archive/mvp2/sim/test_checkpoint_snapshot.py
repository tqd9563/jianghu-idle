from __future__ import annotations

from checkpoint_snapshot import capture_checkpoint_inventory


def test_all_routes_capture_same_pre_boss_inventories() -> None:
    # Given / When
    snapshots = capture_checkpoint_inventory()

    # Then
    assert len(snapshots) == 6
    assert {(item.route, item.checkpoint) for item in snapshots} == {
        (route, checkpoint)
        for route in ("huashan", "shaolin", "tangmen")
        for checkpoint in ("before_boss_2", "before_boss_3")
    }
    signatures = {
        checkpoint: {
            (item.wallet_neili, item.wallet_silver, item.wallet_yueli, item.realm, item.level, item.nodes, item.completed_stage_index)
            for item in snapshots
            if item.checkpoint == checkpoint
        }
        for checkpoint in ("before_boss_2", "before_boss_3")
    }
    assert len(signatures["before_boss_2"]) == 1
    assert len(signatures["before_boss_3"]) == 2


def test_snapshot_accounts_event_rewards_as_already_earned() -> None:
    # Given / When
    snapshots = capture_checkpoint_inventory()

    # Then
    boss_two = snapshots[0]
    assert boss_two.event_earned_silver >= boss_two.wallet_silver
    assert boss_two.event_earned_yueli == boss_two.wallet_yueli + boss_two.spent_yueli
    assert boss_two.gross_earned_neili == boss_two.wallet_neili + boss_two.spent_neili
