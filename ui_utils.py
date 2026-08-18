from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


# All timestamps shown to the player use one explicit timezone.  Storing data
# in UTC stays unchanged; only the presentation is converted.
try:
    MOSCOW_TZ = ZoneInfo("Europe/Moscow")
except ZoneInfoNotFoundError:
    # Some Windows Python installs ship without the IANA tzdata package.
    # Moscow has a fixed UTC+03:00 offset, so this is an equivalent fallback.
    MOSCOW_TZ = timezone(timedelta(hours=3), name="Europe/Moscow")


def as_moscow(value: datetime) -> datetime:
    """Render legacy naive timestamps predictably instead of using Windows time."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(MOSCOW_TZ)


def format_duration(seconds: int | float | None) -> str:
    if seconds is None:
        return "—"
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def format_clock(value: datetime | None) -> str:
    if value is None:
        return "—"
    return as_moscow(value).strftime("%H:%M:%S")


def format_datetime(value: datetime | None) -> str:
    if value is None:
        return "—"
    return as_moscow(value).strftime("%d.%m.%Y %H:%M:%S")


def format_number(value: int | float | None) -> str:
    if value is None:
        return "—"
    return f"{int(value):,}".replace(",", " ")


def remaining(value: datetime | None, now: datetime) -> str:
    if value is None:
        return "—"
    return format_duration(math.ceil((value - now).total_seconds()))
