"""Typed rows the reviews repository returns. Built from query results, never from requests."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ReviewRow(BaseModel):
    """One `booking_reviews` row, plus the booking context a response needs."""

    id: str
    booking_request_id: str
    vendor_user_id: str
    client_user_id: str
    rating: int
    body: str
    created_at: str | None = None
    hidden_at: str | None = None
    image_urls: list[str] = Field(default_factory=list)

    @field_validator("image_urls", mode="before")
    @classmethod
    def _list_or_empty(cls, raw_value: object) -> list[str]:
        """A null `image_urls` column reads as an empty list."""
        return list(raw_value) if isinstance(raw_value, list) else []


class ReviewedBookingRow(BaseModel):
    """The columns of a `booking_requests` row a review needs: ownership, status and event context."""

    id: str
    client_user_id: str
    vendor_user_id: str
    status: str
    event_name: str = "Event"
    event_date: str = ""
    total_label: str = ""


class VendorReviewStatsRow(BaseModel):
    """A vendor's visible-review count and average rating."""

    review_count: int
    average_rating: float | None = None
