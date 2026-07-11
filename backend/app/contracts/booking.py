"""Booking request API models."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, field_validator, model_validator

from app.contracts.reviews import ClientReviewSummary, VendorReviewSummary


class BookingLineItemIn(BaseModel):
    id: str
    heading: str = Field(min_length=1, max_length=200)
    unit_price_gbp: float | None = None
    #: Package / line narrative (e.g. onboarding “details” paragraph).
    description: str | None = Field(default=None, max_length=4000)
    #: Short bullet-style inclusions (e.g. services checklist).
    feature_lines: list[str] = Field(default_factory=list, max_length=25)
    #: e.g. duration text from the vendor profile.
    timeline_line: str | None = Field(default=None, max_length=500)

    @field_validator("heading", mode="before")
    @classmethod
    def strip_heading(cls, v: object) -> str:
        if isinstance(v, str):
            s = v.strip()
            if s:
                return s
        raise ValueError("heading cannot be empty")

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return None

    @field_validator("feature_lines", mode="before")
    @classmethod
    def cap_feature_lines(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for x in v[:25]:
            if not isinstance(x, str):
                continue
            s = x.strip()
            if s:
                out.append(s[:500])
        return out

    @field_validator("timeline_line", mode="before")
    @classmethod
    def strip_timeline(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return None


class VendorAdjustmentItem(BaseModel):
    id: str
    tag: str
    label: str
    amount_gbp: float


class BookingPricingBreakdown(BaseModel):
    line_items_subtotal_gbp: float
    vendor_adjustments: list[VendorAdjustmentItem]
    adjustments_total_gbp: float
    vendor_portion_gbp: float
    service_fee_percent: float
    service_fee_gbp: float
    client_total_gbp: float
    has_pricing_tbc: bool
    vendor_portion_label: str
    service_fee_label: str
    client_total_label: str
    line_items_subtotal_label: str


class VendorAdjustmentIn(BaseModel):
    tag: str = Field(default="other", max_length=50)
    label: str = Field(min_length=1, max_length=200)
    #: Positive = extra cost; negative = discount (stored as signed GBP).
    amount_gbp: float = Field(ge=-1_000_000, le=1_000_000)


class PutVendorBookingAdjustmentsBody(BaseModel):
    adjustments: list[VendorAdjustmentIn] = Field(default_factory=list, max_length=20)


class CreateBookingRequestBody(BaseModel):
    vendor_user_id: str = Field(min_length=1)
    event_name: str = Field(min_length=1, max_length=500)
    event_date: date
    event_end_date: date | None = None
    #: Venue / event location postcode (required for client-initiated requests).
    event_postcode: str = Field(min_length=2, max_length=16)
    #: Full formatted address when using address lookup (optional).
    event_address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
    selected_option_ids: list[str] = Field(min_length=1)
    line_items: list[BookingLineItemIn] = Field(min_length=1)
    total_label: str = Field(min_length=1, max_length=200)

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalize_event_postcode(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("Event postcode is required.")
        s = " ".join(v.strip().split())
        if len(s) < 2:
            raise ValueError("Enter a valid postcode.")
        return s

    @field_validator("event_address", mode="before")
    @classmethod
    def normalize_event_address(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return None

    @model_validator(mode="after")
    def event_end_on_or_after_start(self) -> Self:
        if self.event_end_date is not None and self.event_end_date < self.event_date:
            raise ValueError("Event end date must be on or after the event start date.")
        return self


class CreateVendorQuoteBody(BaseModel):
    client_user_id: str = Field(min_length=1)
    conversation_id: str | None = None
    event_name: str = Field(min_length=1, max_length=500)
    event_date: date
    event_end_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    line_items: list[BookingLineItemIn] = Field(min_length=1)

    @model_validator(mode="after")
    def quote_end_on_or_after_start(self) -> Self:
        if self.event_end_date is not None and self.event_end_date < self.event_date:
            raise ValueError("Event end date must be on or after the event start date.")
        return self


class BookingRequestCreated(BaseModel):
    success: bool = True
    id: str
    status: Literal["pending", "accepted", "declined", "cancelled"] = "pending"
    created_at: str | None = None


class VendorBookingListItem(BaseModel):
    id: str
    status: str
    event_name: str
    event_date: str
    event_end_date: str | None = None
    total_label: str
    client_email: str | None = None
    created_at: str | None = None
    client_total_label: str | None = None
    review: VendorReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    payment_status: str = "unpaid"


class VendorBookingsListResponse(BaseModel):
    success: bool = True
    bookings: list[VendorBookingListItem]


class VendorBookingDetail(BaseModel):
    id: str
    status: str
    event_name: str
    event_date: str
    event_end_date: str | None = None
    event_postcode: str | None = None
    event_address: str | None = None
    notes: str | None = None
    total_label: str
    selected_option_ids: list[str]
    line_items: list[dict[str, Any]]
    vendor_adjustments: list[VendorAdjustmentItem] = Field(default_factory=list)
    pricing: BookingPricingBreakdown | None = None
    client_user_id: str | None = None
    client_email: str | None = None
    counterparty_phone: str | None = None
    created_at: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    review: VendorReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None


class VendorBookingDetailResponse(BaseModel):
    success: bool = True
    booking: VendorBookingDetail


class PutVendorBookingAdjustmentsResponse(BaseModel):
    success: bool = True
    booking: VendorBookingDetail


class VendorBookingStatusBody(BaseModel):
    #: Completion is a separate mutual-confirmation flow (see confirm-completion endpoints).
    status: Literal["accepted", "declined", "cancelled"]


class VendorBookingStatusResponse(BaseModel):
    success: bool = True
    id: str
    status: str


class ClientBookingListItem(BaseModel):
    id: str
    status: str
    event_name: str
    event_date: str
    event_end_date: str | None = None
    total_label: str
    client_total_label: str | None = None
    vendor_user_id: str
    vendor_display_name: str
    created_at: str | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    has_review: bool = False
    payment_status: str = "unpaid"


class ClientBookingsListResponse(BaseModel):
    success: bool = True
    bookings: list[ClientBookingListItem]


class ClientBookingDetail(BaseModel):
    id: str
    status: str
    vendor_user_id: str
    vendor_display_name: str
    event_name: str
    event_date: str
    event_end_date: str | None = None
    event_postcode: str | None = None
    event_address: str | None = None
    notes: str | None = None
    total_label: str
    selected_option_ids: list[str]
    line_items: list[dict[str, Any]]
    vendor_adjustments: list[VendorAdjustmentItem] = Field(default_factory=list)
    pricing: BookingPricingBreakdown | None = None
    created_at: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    review: ClientReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    counterparty_phone: str | None = None


class ClientBookingStatusBody(BaseModel):
    status: Literal["accepted", "declined"]
    #: Required when accepting a vendor quote (initiator vendor); ignored when declining.
    event_postcode: str | None = Field(default=None, max_length=16)
    event_address: str | None = Field(default=None, max_length=500)

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalize_event_postcode_optional(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = " ".join(v.strip().split())
            return s if s else None
        return None

    @field_validator("event_address", mode="before")
    @classmethod
    def normalize_event_address_optional(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return None


class UpdateBookingVenueBody(BaseModel):
    event_postcode: str = Field(min_length=2, max_length=16)
    event_address: str = Field(min_length=3, max_length=500)

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalize_postcode(cls, v: object) -> str:
        if isinstance(v, str):
            s = " ".join(v.strip().split())
            if len(s) >= 2:
                return s
        raise ValueError("Enter a valid postcode.")

    @field_validator("event_address", mode="before")
    @classmethod
    def normalize_address(cls, v: object) -> str:
        if isinstance(v, str):
            s = v.strip()
            if len(s) >= 3:
                return s
        raise ValueError("Enter a full event address.")


class ClientBookingDetailResponse(BaseModel):
    success: bool = True
    booking: ClientBookingDetail


class BookingNotificationsUnreadResponse(BaseModel):
    success: bool = True
    unread_count: int
