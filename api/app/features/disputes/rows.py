"""Typed rows the disputes repository returns. Built from query results, never from requests.

Timestamps arrive as ISO text (see `core.db.plain_value`), the way the baseline
read them from PostgREST, so the pure rules in `domain.py` work on text.
"""

from __future__ import annotations

from pydantic import BaseModel


class DisputeRow(BaseModel):
    """Every column a dispute screen or resolution rule reads."""

    id: str
    booking_request_id: str
    opened_by_user_id: str
    status: str
    summary: str
    internal_notes: str | None = None
    resolution_note: str | None = None
    client_resolution_note: str | None = None
    vendor_resolution_note: str | None = None
    assigned_admin_id: str | None = None
    conversation_id: str | None = None
    resolution_action: str | None = None
    refund_amount_gbp: float | None = None
    created_at: str | None = None
    updated_at: str | None = None
    resolved_at: str | None = None


class DisputeBookingRow(BaseModel):
    """The slice of a booking a dispute needs: who it belongs to and its money state.

    Read from `booking_requests` through a lightweight table handle (the sanctioned
    pattern `bookings/repository.py` also uses to read tables it doesn't own),
    since `disputes` must not import `bookings`' repository or models.
    """

    id: str
    client_user_id: str
    vendor_user_id: str
    status: str
    payment_status: str
    conversation_id: str | None = None
    event_name: str = ""
    event_date: str | None = None
    payment_amount_gbp: float | None = None


class UserRoleRow(BaseModel):
    """Just enough of a `users` row to check who a dispute assignee is."""

    id: str
    user_type: str | None = None
    account_suspended: bool = False
