"""Durable append-only journal for reports produced by the battle simulator."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from config import DATA_DIR


try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except ZoneInfoNotFoundError:
    # Standard Windows Python can be installed without IANA tzdata. Moscow has
    # a fixed UTC+03:00 offset, so this remains the requested local time.
    MOSCOW_TZ = timezone(timedelta(hours=3), name="Europe/Moscow")
SIMULATION_LOG_DIR = DATA_DIR / "simulation-battles"
PLANET_CACHE_PATH = SIMULATION_LOG_DIR / "planet-top7-cache.json"
# Version 2 starts after the corrected two-stage simulator/report flow.
PLANET_MATRIX_VERSION = 2


def _current_path() -> Path:
    SIMULATION_LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(MOSCOW_TZ).strftime("%Y-%m-%d")
    return SIMULATION_LOG_DIR / f"battles-{stamp}.jsonl"


def append_trial(record: dict[str, Any]) -> Path:
    """Append and fsync one report so an interrupted batch loses no history."""
    payload = dict(record)
    payload.setdefault("saved_at", datetime.now(MOSCOW_TZ).isoformat(timespec="seconds"))
    path = _current_path()
    line = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(line)
        handle.flush()
        os.fsync(handle.fileno())
    return path


def load_recent_trials(limit: int = 300) -> list[dict[str, Any]]:
    """Read recent valid journal rows without letting one damaged line break UI."""
    rows: list[dict[str, Any]] = []
    for path in sorted(SIMULATION_LOG_DIR.glob("battles-*.jsonl"), reverse=True):
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for line in reversed(lines):
            try:
                row = json.loads(line)
            except (TypeError, ValueError):
                continue
            if isinstance(row, dict):
                rows.append(row)
            if len(rows) >= limit:
                return rows
    return rows


def load_planet_cache(combat_limit: int, own_level: int) -> dict[str, Any] | None:
    """Return a completed Top-7 matrix for this exact population limit."""
    try:
        payload = json.loads(PLANET_CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError):
        return None
    key = f"v{PLANET_MATRIX_VERSION}:{int(combat_limit)}:{int(own_level)}"
    item = payload.get(key) if isinstance(payload, dict) else None
    return item if isinstance(item, dict) and item.get("plans") else None


def save_planet_cache(combat_limit: int, own_level: int, plans: list[dict[str, Any]]) -> Path:
    """Atomically replace only the compact summary cache; trial history stays append-only."""
    SIMULATION_LOG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.loads(PLANET_CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    key = f"v{PLANET_MATRIX_VERSION}:{int(combat_limit)}:{int(own_level)}"
    payload[key] = {
        "saved_at": datetime.now(MOSCOW_TZ).isoformat(timespec="seconds"),
        "combat_limit": int(combat_limit),
        "own_level": int(own_level),
        "plans": plans,
    }
    temporary = PLANET_CACHE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(PLANET_CACHE_PATH)
    return PLANET_CACHE_PATH
