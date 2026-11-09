"""DateTime utility helpers for UTC handling in ChargeGuard AI Pro."""

from datetime import datetime, timezone

def utc_now() -> datetime:
    """Return naive UTC datetime for seamless SQLite / SQLAlchemy compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def utc_now_iso() -> str:
    """Return ISO8601 formatted string of current UTC time."""
    return datetime.now(timezone.utc).isoformat()
