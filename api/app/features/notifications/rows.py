"""Typed rows the notifications repositories return, in the plain shape of `core.db.plain_row`.

Ids are text and timestamps ISO text, as the baseline's PostgREST rows were.
"""

from __future__ import annotations

from pydantic import BaseModel


class StoredNotificationRow(BaseModel):
    """One `booking_notifications` row."""

    id: str
    booking_id: str
    kind: str
    body: str | None = None
    read_at: str | None = None
    created_at: str | None = None


class DisputeNoticeRow(BaseModel):
    """The parts of a `dispute_cases` row the feed shows."""

    status: str | None = None
    summary: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class FeedLineRow(BaseModel):
    """One merged feed line: a stored notice or a dispute, told apart by `source`.

    Notice-only fields are None on a dispute and dispute-only fields on a notice.
    """

    source: str
    id: str
    booking_id: str | None = None
    kind: str | None = None
    body: str | None = None
    read_at: str | None = None
    status: str | None = None
    summary: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class BookingPartiesRow(BaseModel):
    """Who is on a booking, and its event name, for addressing a booking notice."""

    client_user_id: str
    vendor_user_id: str
    event_name: str | None = None
