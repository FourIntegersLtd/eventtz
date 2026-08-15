"""Read booking requests from the database."""

from __future__ import annotations

from typing import Any

from app.core.db import apply_recent_first_order, get_db, first_row_from_query_result, rows_from_query_result
from app.features.bookings.list_order import sort_booking_rows_recent_first


def get_booking_request_by_id(booking_id: str, *, columns: str = "*") -> dict[str, Any] | None:
    res = get_db().table("booking_requests").select(columns).eq("id", booking_id).limit(1).execute()
    return first_row_from_query_result(res)


def list_for_vendor(
    vendor_user_id: str,
    *,
    status_filter: list[str] | None = None,
    columns: str = "*",
) -> list[dict[str, Any]]:
    q = get_db().table("booking_requests").select(columns).eq("vendor_user_id", vendor_user_id)
    if status_filter:
        q = q.in_("status", status_filter)
    res = apply_recent_first_order(q).execute()
    return sort_booking_rows_recent_first(rows_from_query_result(res))


def list_for_client(
    client_user_id: str,
    *,
    status_filter: list[str] | None = None,
    columns: str = "*",
) -> list[dict[str, Any]]:
    q = get_db().table("booking_requests").select(columns).eq("client_user_id", client_user_id)
    if status_filter:
        q = q.in_("status", status_filter)
    res = apply_recent_first_order(q).execute()
    return sort_booking_rows_recent_first(rows_from_query_result(res))
