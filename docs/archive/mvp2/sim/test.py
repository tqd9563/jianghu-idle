#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pytest>=8,<9"]
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv, no pip install needed):
#      uv run test.py
# 3. Or make executable and run:
#      chmod +x test.py && ./test.py
# ──────────────────

from __future__ import annotations

from pathlib import Path

import pytest


def main() -> int:
    return pytest.main([str(Path(__file__).parent), "-q"])


if __name__ == "__main__":
    raise SystemExit(main())
