"""Booking requests table access."""

from __future__ import annotations

from typing import Any

from app.core.db import one_row, rows
from app.core.db import get_db


def get_by_id(booking_id: str, *, columns: str = "*") -> dict[str, Any] | None:
    res = get_db().table("booking_requests").select(columns).eq("id", booking_id).limit(1).execute()
    return one_row(res)


def list_for_vendor(
    vendor_user_id: str,
    *,
    status_filter: list[str] | None = None,
    columns: str = "*",
) -> list[dict[str, Any]]:
    q = get_db().table("booking_requests").select(columns).eq("vendor_user_id", vendor_user_id)
    if status_filter:
        q = q.in_("status", status_filter)
    res = q.order("created_at", desc=True).execute()
    return rows(res)


def list_for_client(
    client_user_id: str,
    *,
    status_filter: list[str] | None = None,
    columns: str = "*",
) -> list[dict[str, Any]]:
    q = get_db().table("booking_requests").select(columns).eq("client_user_id", client_user_id)
    if status_filter:
        q = q.in_("status", status_filter)
    res = q.order("created_at", desc=True).execute()
    return rows(res)
