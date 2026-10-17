"""Request and response bodies for disputes, named as in the baseline contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CreateDisputeBody(BaseModel):
    """Open a dispute on a booking."""

    summary: str = Field(min_length=10, max_length=4000)


class DisputePublic(BaseModel):
    """A dispute as a client or vendor sees it."""

    id: str
    booking_request_id: str
    opened_by_user_id: str
    status: Literal["open", "under_review", "resolved", "closed"]
    summary: str
    created_at: str | None = None
    updated_at: str | None = None
    resolved_at: str | None = None
    resolution_note: str | None = None
    event_name: str | None = None
    event_date: str | None = None
    booking_lifecycle_status: str | None = None
    payment_status: str | None = None
    conversation_id: str | None = None
    opened_by_role: Literal["client", "vendor"] | None = None
    opened_by_you: bool = False
    opened_by_display_name: str | None = None
    client_label: str | None = None
    vendor_display_name: str | None = None
    counterparty_label: str | None = None


class DisputesListResponse(BaseModel):
    """A participant's disputes, most recently opened first."""

    disputes: list[DisputePublic]


class DisputeDetailResponse(BaseModel):
    """One dispute, for the participant fetching it."""

    dispute: DisputePublic


class CreateDisputeResponse(BaseModel):
    """The dispute just opened."""

    dispute: DisputePublic


class AdminDisputeCase(BaseModel):
    """A dispute as staff see it: every internal field, plus who everyone involved is."""

    id: str
    booking_request_id: str
    opened_by_user_id: str
    status: Literal["open", "under_review", "resolved", "closed"]
    summary: str
    internal_notes: str | None = None
    resolution_note: str | None = None
    client_resolution_note: str | None = None
    vendor_resolution_note: str | None = None
    assigned_admin_id: str | None = None
    assigned_admin_email: str | None = None
    conversation_id: str | None = None
    resolution_action: (
        Literal["release_to_vendor", "refund_client", "partial_refund", "vendor_no_show"] | None
    ) = None
    refund_amount_gbp: float | None = None
    created_at: str | None = None
    updated_at: str | None = None
    resolved_at: str | None = None
    event_name: str | None = None
    event_date: str | None = None
    booking_status: str | None = None
    client_email: str | None = None
    vendor_display_name: str | None = None
    vendor_email: str | None = None
    opened_by_role: Literal["client", "vendor"] | None = None
    opened_by_email: str | None = None
    opened_by_display_name: str | None = None


class AdminDisputesListResponse(BaseModel):
    """Every dispute matching the admin list's status filter."""

    disputes: list[AdminDisputeCase]


class AdminDisputePatchBody(BaseModel):
    """What staff may change on a dispute. Only the fields actually set are applied."""

    status: Literal["open", "under_review", "resolved", "closed"] | None = None
    internal_notes: str | None = None
    resolution_note: str | None = None
    client_resolution_note: str | None = None
    vendor_resolution_note: str | None = None
    assigned_admin_id: str | None = None
    resolution_action: (
        Literal["release_to_vendor", "refund_client", "partial_refund", "vendor_no_show"] | None
    ) = None
    refund_amount_gbp: float | None = Field(default=None, gt=0)
