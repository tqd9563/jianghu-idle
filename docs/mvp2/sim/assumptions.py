from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import TypedDict

from offline_sim import Checkpoint, CheckpointAssumptions, Investment, ResourceBundle, RunVariant, ScenarioGrid


class RawBundle(TypedDict):
    neili: str
    silver: str
    experience: str


class RawCheckpoint(TypedDict):
    checkpoint: str
    hourly_rate: RawBundle
    bank: RawBundle
    meaningful_investment: RawBundle
    checkpoint_gate_total: RawBundle
    remaining_run_total: RawBundle


class RawAssumptions(TypedDict):
    assumptions_id: str
    status: str
    unit_system: str
    offline_cap_hours: str
    run_multipliers: dict[str, str]
    checkpoints: list[RawCheckpoint]


@dataclass(frozen=True, slots=True)
class LoadedAssumptions:
    assumptions_id: str
    status: str
    unit_system: str
    grid: ScenarioGrid


def _bundle(raw: RawBundle) -> ResourceBundle:
    return ResourceBundle(Decimal(raw["neili"]), Decimal(raw["silver"]), Decimal(raw["experience"]))


def _checkpoint(raw: RawCheckpoint) -> CheckpointAssumptions:
    investments = (
        Investment("meaningful_investment", _bundle(raw["meaningful_investment"])),
        Investment("checkpoint_gate_total", _bundle(raw["checkpoint_gate_total"])),
        Investment("remaining_run_total", _bundle(raw["remaining_run_total"])),
    )
    return CheckpointAssumptions(
        checkpoint=Checkpoint(raw["checkpoint"]), hourly_rate=_bundle(raw["hourly_rate"]), bank=_bundle(raw["bank"]),
        investments=investments, checkpoint_gate_ids=("checkpoint_gate_total",), remaining_run_ids=("remaining_run_total",),
    )


def load_assumptions(path: Path) -> LoadedAssumptions:
    with path.open(encoding="utf-8") as source:
        raw: RawAssumptions = json.load(source)
    if Decimal(raw["offline_cap_hours"]) != Decimal("8"):
        msg = "offline_cap_hours must match cadence.md §4.1 (8 hours)"
        raise ValueError(msg)
    multipliers = {RunVariant(key): Decimal(value) for key, value in raw["run_multipliers"].items()}
    return LoadedAssumptions(raw["assumptions_id"], raw["status"], raw["unit_system"], ScenarioGrid(tuple(_checkpoint(item) for item in raw["checkpoints"]), multipliers))
