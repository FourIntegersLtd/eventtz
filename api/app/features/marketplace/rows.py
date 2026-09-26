"""Typed rows the marketplace repositories return, in the plain shape of `core.db.plain_row`.

Ids are text, timestamps ISO text and numerics floats, as the baseline's PostgREST
rows were, so the ported rules read them unchanged.
"""

from __future__ import annotations

from pydantic import BaseModel


class ReviewStatsRow(BaseModel):
    """A vendor's visible-review count and average (the `vendor_review_stats` view)."""

    vendor_user_id: str
    review_count: int = 0
    average_rating: float | None = None


class BookingTotalsRow(BaseModel):
    """Per-vendor booking totals behind the public trust signals on explore cards."""

    vendor_user_id: str
    completed_bookings: int = 0
    client_enquiries: int = 0
    response_seconds_total: float | None = None
    responses_timed: int = 0


class PublicReviewRow(BaseModel):
    """One visible review with its booking's event details and the reviewer's email."""

    id: str
    rating: int | None = None
    body: str | None = None
    created_at: str | None = None
    client_email: str | None = None
    event_name: str | None = None
    event_date: str | None = None
    total_label: str | None = None


class SnippetCandidateRow(BaseModel):
    """A visible review that could be quoted on a plan-search card."""

    vendor_user_id: str
    rating: int | None = None
    body: str | None = None
    client_email: str | None = None


class AnalyticsEnquiryRow(BaseModel):
    """A client enquiry to the vendor, with the fields the analytics screen counts."""

    status: str | None = None
    payment_status: str | None = None
    created_at: str | None = None
    accepted_at: str | None = None
    completed_at: str | None = None
    vendor_response_time_seconds: int | None = None
    payment_amount_gbp: float | None = None
    vendor_amount_gbp: float | None = None
    event_date: str | None = None
    failure_reason: str | None = None


class AnalyticsRatingRow(BaseModel):
    """A visible review's rating and when it was left."""

    rating: int | None = None
    created_at: str | None = None
