"""User-facing dispute API models (participants see a subset of fields)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateParticipantDisputeBody(BaseModel):
    summary: str = Field(min_length=10, max_length=4000)


class ParticipantDisputePublic(BaseModel):
    """Fields safe for client/vendor — no internal admin notes."""

    id: str
    booking_request_id: str
    opened_by_user_id: str
    status: Literal["open", "under_review", "resolved", "closed"]
    summary: str
    created_at: str | None = None
    updated_at: str | None = None
    resolved_at: str | None = None
    resolution_note: str | None = None
    #: True when an in-app Messages thread was linked for staff review at case open.
    chat_included_for_review: bool = False
    #: Booking context (detail + list).
    event_name: str | None = None
    event_date: str | None = None
    booking_status: str | None = None
    conversation_id: str | None = None
    opened_by_role: Literal["client", "vendor"] | None = None
    opened_by_you: bool = False
    opened_by_display_name: str | None = None
    client_label: str | None = None
    vendor_display_name: str | None = None
    counterparty_label: str | None = None
    payment_status: str | None = None


class ParticipantDisputesListResponse(BaseModel):
    success: bool = True
    disputes: list[ParticipantDisputePublic]


class ParticipantDisputeDetailResponse(BaseModel):
    success: bool = True
    dispute: ParticipantDisputePublic


class CreateParticipantDisputeResponse(BaseModel):
    success: bool = True
    dispute: ParticipantDisputePublic


class AdminVendorInsightsResponse(BaseModel):
    success: bool = True
    user_id: str
    review_average: float | None = None
    review_count: int = 0
    bookings_total: int = 0
    bookings_by_status: dict[str, int] = Field(default_factory=dict)
    open_disputes_on_bookings: int = 0
    explore_path: str = ""
