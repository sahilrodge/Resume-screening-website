"""Datetime helpers."""

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(UTC)
