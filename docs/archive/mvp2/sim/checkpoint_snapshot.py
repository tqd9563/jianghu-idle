from __future__ import annotations

import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Final

ROUTES: Final = ("huashan", "shaolin", "tangmen")
SIM_PATH: Final = Path(__file__).parents[3] / "systems" / "sim" / "mvp0_sim.py"


@dataclass(frozen=True, slots=True)
class CheckpointSnapshot:
    route: str
    checkpoint: str
    wallet_neili: float
    wallet_silver: float
    wallet_yueli: float
    realm: int
    level: int
    nodes: int
    completed_stage_index: int
    gross_earned_neili: float
    spent_neili: float
    event_earned_neili: float
    event_earned_silver: float
    event_earned_yueli: float
    spent_yueli: float


def _load_simulator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("mvp0_snapshot_source", SIM_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(SIM_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def capture_checkpoint_inventory() -> tuple[CheckpointSnapshot, ...]:
    simulator = _load_simulator()
    captured: list[CheckpointSnapshot] = []
    for route in ROUTES:
        raw_rows: list[dict[str, str | float | int]] = []
        simulator.run_playthrough(route, snapshot_sink=raw_rows.append)
        captured.extend(CheckpointSnapshot(**row) for row in raw_rows)
    return tuple(captured)


def render_snapshot_json() -> str:
    rows = [
        {field: getattr(item, field) for field in item.__dataclass_fields__}
        for item in capture_checkpoint_inventory()
    ]
    return json.dumps({"snapshot_id": "mvp0-pre-boss-2-3-v0", "snapshots": rows}, ensure_ascii=False, indent=2) + "\n"
