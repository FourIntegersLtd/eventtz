"""Request and response shapes for the reviews routes. Never imports `models`/`rows`."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.reviews.domain import MAX_REVIEW_IMAGES, normalized_review_image_urls


class PostBookingReviewBody(BaseModel):
    """A client's rating and comment on a completed booking."""

    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=10, max_length=4000)
    image_urls: list[str] = Field(default_factory=list)

    @field_validator("image_urls", mode="before")
    @classmethod
    def _normalize_and_cap(cls, raw_value: Any) -> list[str]:
        """Drop non-http(s) URLs silently (baseline quirk); reject more than the cap outright."""
        if isinstance(raw_value, list) and len(raw_value) > MAX_REVIEW_IMAGES:
            raise ValueError(f"You can attach up to {MAX_REVIEW_IMAGES} photos.")
        return normalized_review_image_urls(raw_value)


class ReviewVisibilityBody(BaseModel):
    """An admin's decision to hide or unhide a review."""

    hidden: bool


class SubmittedReview(BaseModel):
    """The just-created review, as returned to the client who submitted it."""

    id: str
    rating: int
    body: str
    created_at: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class PostBookingReviewResponse(BaseModel):
    """Response for `POST /client/booking-requests/{id}/review`."""

    success: bool = True
    review: SubmittedReview


class ClientOwnerReviewItem(BaseModel):
    """One review from the client's own reviews list, with vendor and event context."""

    id: str
    rating: int
    body: str
    created_at: str | None = None
    booking_request_id: str
    vendor_user_id: str
    vendor_display_name: str = "Vendor"
    event_name: str = "Event"
    event_date: str = ""
    image_urls: list[str] = Field(default_factory=list)


class ClientOwnerReviewsResponse(BaseModel):
    """Response for `GET /client/reviews`."""

    success: bool = True
    review_count: int = 0
    reviews: list[ClientOwnerReviewItem] = Field(default_factory=list)


class VendorOwnerReviewItem(BaseModel):
    """One review from the vendor's own reviews list: only ever the visible ones."""

    id: str
    rating: int
    body: str
    created_at: str | None = None
    reviewer_display: str
    event_name: str = "Event"
    event_date: str = ""
    booking_total_label: str = ""
    image_urls: list[str] = Field(default_factory=list)
    booking_request_id: str


class VendorOwnerReviewsResponse(BaseModel):
    """Response for `GET /vendor/reviews`."""

    success: bool = True
    average_rating: float | None = None
    review_count: int = 0
    five_star_count: int = 0
    reviews: list[VendorOwnerReviewItem] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


class AdminReviewRow(BaseModel):
    """One review row for staff, hidden ones included, with moderation and booking context."""

    id: str
    booking_request_id: str
    vendor_user_id: str
    client_user_id: str
    rating: int = 0
    body: str = ""
    hidden_at: str | None = None
    created_at: str | None = None
    vendor_display_name: str | None = None
    client_email: str | None = None
    booking_event_name: str | None = None
    booking_event_date: str | None = None
    booking_status: str | None = None


class AdminReviewsListResponse(BaseModel):
    """Response for `GET /admin/reviews`."""

    success: bool = True
    reviews: list[AdminReviewRow] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = 100


class AdminReviewDetailResponse(BaseModel):
    """Response for `GET /admin/reviews/{review_id}`."""

    success: bool = True
    review: AdminReviewRow


class ReviewVisibilityResponse(BaseModel):
    """Response for `PATCH /admin/reviews/{review_id}/visibility`. Always success, even for a
    review id that does not exist (see `errors.py` for why).
    """

    success: bool = True
