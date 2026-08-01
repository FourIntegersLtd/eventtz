"""Shared types for booking reviews (public pages and signed-in users)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


MAX_REVIEW_IMAGES = 5


def normalize_review_image_urls(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        url = str(item or "").strip()
        if not url:
            continue
        if not (url.startswith("https://") or url.startswith("http://")):
            continue
        if url not in out:
            out.append(url)
        if len(out) >= MAX_REVIEW_IMAGES:
            break
    return out


class PublicReviewItem(BaseModel):
    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str
    event_name: str
    event_date: str = ""
    booking_total_label: str = ""
    image_urls: list[str] = Field(default_factory=list)


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
    image_urls: list[str] = Field(default_factory=list)


class ClientOwnerReviewsResponse(BaseModel):
    success: bool = True
    review_count: int = 0
    reviews: list[ClientOwnerReviewItem] = Field(default_factory=list)


class PostBookingReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=10, max_length=4000)
    image_urls: list[str] = Field(default_factory=list)

    @field_validator("image_urls", mode="before")
    @classmethod
    def validate_image_urls(cls, value: Any) -> list[str]:
        urls = normalize_review_image_urls(value)
        if isinstance(value, list) and len(value) > MAX_REVIEW_IMAGES:
            raise ValueError(f"You can attach up to {MAX_REVIEW_IMAGES} photos.")
        return urls


class ClientReviewSummary(BaseModel):
    id: str
    rating: int
    body: str = ""
    created_at: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class VendorReviewSummary(BaseModel):
    """Client-authored review visible to the vendor for a booking."""

    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str
    image_urls: list[str] = Field(default_factory=list)


class PostBookingReviewResponse(BaseModel):
    success: bool = True
    review: dict[str, Any]
