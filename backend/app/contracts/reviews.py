"""Shared types for booking reviews (public pages and signed-in users)."""

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


class VendorOwnerReviewItem(PublicReviewItem):
    booking_request_id: str


class VendorOwnerReviewsResponse(BaseModel):
    success: bool = True
    average_rating: float | None = None
    review_count: int = 0
    reviews: list[VendorOwnerReviewItem] = Field(default_factory=list)


class ClientOwnerReviewItem(BaseModel):
    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    booking_request_id: str
    vendor_user_id: str
    vendor_display_name: str = "Vendor"
    event_name: str = "Event"
    event_date: str = ""


class ClientOwnerReviewsResponse(BaseModel):
    success: bool = True
    review_count: int = 0
    reviews: list[ClientOwnerReviewItem] = Field(default_factory=list)


class PostBookingReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=10, max_length=4000)


class ClientReviewSummary(BaseModel):
    id: str
    rating: int
    body: str = ""
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
