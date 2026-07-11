"""Public and client booking review models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PublicReviewItem(BaseModel):
    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str
    event_name: str
    event_date: str = ""
    booking_total_label: str = ""


class VendorPublicReviewsResponse(BaseModel):
    success: bool = True
    average_rating: float | None = None
    review_count: int = 0
    reviews: list[PublicReviewItem] = Field(default_factory=list)


class PostBookingReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=10, max_length=4000)


class ClientReviewSummary(BaseModel):
    id: str
    rating: int
    created_at: str | None = None


class VendorReviewSummary(BaseModel):
    """Client-authored review visible to the vendor for a booking."""

    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str


class PostBookingReviewResponse(BaseModel):
    success: bool = True
    review: dict[str, Any]
