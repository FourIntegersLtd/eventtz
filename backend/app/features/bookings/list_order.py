"""Sort booking lists with the most recent activity first."""

from __future__ import annotations

from typing import Any


def sort_booking_rows_recent_first(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort booking rows by latest activity, then creation time, then id."""

    def key(row: dict[str, Any]) -> tuple[str, str, str]:
        activity = str(row.get("updated_at") or row.get("created_at") or "")
        return (activity, str(row.get("created_at") or ""), str(row.get("id") or ""))

    return sorted(rows, key=key, reverse=True)
