"""Request bodies and responses for booking requests, quotes and status changes.

Field names, aliases and validation messages are the baseline's (`contracts/booking.py`),
because the web app reads them directly. The ids are serialised as
`booking_request_id` / `booking_status`; the aliases only let the services build
them from row-shaped dicts (`id`, `status`).
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# A client referral code is at most this many digits (as in the referrals slice).
_REFERRAL_CODE_MAX_DIGITS = 6
_PRICE_OUT_OF_RANGE = "Enter a price between £0 and £1,000,000."
_WHOLE_NUMBER = "Each quantity must be a whole number."


def _collapsed_postcode(value: object, *, min_length: int) -> str | None:
    """Postcode text with runs of whitespace collapsed; `None` when shorter than `min_length`."""
    if not isinstance(value, str):
        return None
    collapsed = " ".join(value.strip().split())
    return collapsed if len(collapsed) >= min_length else None


def _stripped_or_none(value: object) -> str | None:
    """Trimmed text, or `None` for blank or non-text values."""
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _check_event_dates(event_date: date, event_end_date: date | None) -> None:
    """Reject an event that starts in the past or ends before it starts."""
    if event_date < date.today():
        raise ValueError("Event date cannot be in the past.")
    if event_end_date is not None and event_end_date < event_date:
        raise ValueError("Event end date must be on or after the event start date.")


# --- reviews shown on a booking ----------------------------------------------------------------------


class ClientReviewSummary(BaseModel):
    """The review the client left on this booking, shown back to them."""

    id: str
    rating: int
    body: str = ""
    created_at: str | None = None
    image_urls: list[str] = Field(default_factory=list)


class VendorReviewSummary(BaseModel):
    """The client's review of this booking, as the vendor sees it."""

    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str
    image_urls: list[str] = Field(default_factory=list)


# --- pricing -----------------------------------------------------------------------------------------


class BookingLineItemIn(BaseModel):
    """One line of a vendor's quote."""

    id: str
    heading: str = Field(min_length=1, max_length=200)
    unit_price_gbp: float | None = None
    # Per-unit packages: the client-chosen count. Omitted for fixed packages.
    quantity: int | None = Field(default=None, ge=1, le=100_000)
    # The discounted unit rate before quantity (per-unit packages).
    unit_rate_gbp: float | None = None
    # The item name for per-unit packages (e.g. chair).
    unit_label: str | None = Field(default=None, max_length=40)
    description: str | None = Field(default=None, max_length=4000)
    feature_lines: list[str] = Field(default_factory=list, max_length=25)
    # e.g. the duration text from the vendor profile.
    timeline_line: str | None = Field(default=None, max_length=500)

    @field_validator("heading", mode="before")
    @classmethod
    def strip_heading(cls, value: object) -> str:
        """A trimmed heading; a blank one is refused."""
        if isinstance(value, str) and value.strip():
            return value.strip()
        raise ValueError("Give this package a name.")

    @field_validator("description", "timeline_line", mode="before")
    @classmethod
    def strip_optional_text(cls, value: object) -> str | None:
        """Trimmed text, or `None` when blank."""
        return _stripped_or_none(value)

    @field_validator("feature_lines", mode="before")
    @classmethod
    def cap_feature_lines(cls, value: object) -> list[str]:
        """The first 25 non-blank lines, each trimmed to 500 characters."""
        if not isinstance(value, list):
            return []
        return [line.strip()[:500] for line in value[:25] if isinstance(line, str) and line.strip()]

    @field_validator("unit_price_gbp", "unit_rate_gbp")
    @classmethod
    def bound_unit_price(cls, value: float | None) -> float | None:
        """Prices run from £0 to £1,000,000."""
        if value is not None and (value < 0 or value > 1_000_000):
            raise ValueError(_PRICE_OUT_OF_RANGE)
        return value


class VendorAdjustmentItem(BaseModel):
    """A stored vendor extra (positive) or discount (negative)."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    adjustment_category: str = Field(validation_alias="tag")
    label: str
    amount_gbp: float


class BookingPricingBreakdown(BaseModel):
    """Every figure and label the booking screens show for the price."""

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
    service_fee_before_discount_gbp: float | None = None
    service_fee_before_discount_label: str | None = None
    referral_fee_discount_gbp: float = 0.0
    referral_fee_discount_label: str | None = None
    referral_tier_min_spend_gbp: float | None = None
    vendor_referral_code: str | None = None
    referral_fee_applied: bool = False


class VendorAdjustmentIn(BaseModel):
    """One extra or discount a vendor puts on a pending request."""

    model_config = ConfigDict(populate_by_name=True)

    adjustment_category: str = Field(default="other", max_length=50, validation_alias="tag")
    label: str = Field(min_length=1, max_length=200)
    # Positive is an extra cost; negative is a discount (signed GBP).
    amount_gbp: float = Field(ge=-1_000_000, le=1_000_000)


class PutVendorBookingAdjustmentsBody(BaseModel):
    """The full new list of the vendor's extras and discounts (replaces the old one)."""

    adjustments: list[VendorAdjustmentIn] = Field(default_factory=list, max_length=20)


# --- creating ----------------------------------------------------------------------------------------


class CreateBookingRequestBody(BaseModel):
    """A client's booking request for some of a vendor's packages."""

    model_config = ConfigDict(extra="forbid")

    vendor_user_id: str = Field(min_length=1)
    event_name: str = Field(min_length=1, max_length=500)
    event_date: date
    event_end_date: date | None = None
    # Venue postcode: optional on the request, required before paying.
    event_postcode: str | None = Field(default=None, max_length=16)
    event_address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
    selected_option_ids: list[str] = Field(min_length=1)
    # Client-chosen counts keyed by package id; needed for per-unit packages only.
    quantities: dict[str, int] | None = None
    # The marketplace search at enquiry time (for alternative-vendor nudges).
    client_search_context: dict[str, Any] | None = None
    event_id: str | None = Field(default=None, max_length=36)
    # The vendor's client referral code (`?vref=`), up to six digits.
    vendor_referral_code: str | None = Field(default=None, max_length=6)

    @field_validator("vendor_referral_code", mode="before")
    @classmethod
    def normalise_referral_code(cls, value: object) -> str | None:
        """The code's digits, or `None` when there are none or more than six."""
        if not isinstance(value, str) or not value:
            return None
        digits = re.sub(r"\D", "", value.strip())
        return digits if digits and len(digits) <= _REFERRAL_CODE_MAX_DIGITS else None

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalise_postcode(cls, value: object) -> str | None:
        """Collapsed whitespace; anything under two characters is dropped."""
        return _collapsed_postcode(value, min_length=2)

    @field_validator("event_address", mode="before")
    @classmethod
    def normalise_address(cls, value: object) -> str | None:
        """Trimmed text, or `None` when blank."""
        return _stripped_or_none(value)

    @field_validator("quantities", mode="before")
    @classmethod
    def normalise_quantities(cls, value: object) -> dict[str, int] | None:
        """Whole-number counts from 1 to 100,000 keyed by package id; an empty map is `None`."""
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValueError("Quantities must be a map of package id to count.")
        counts: dict[str, int] = {}
        for raw_key, raw_count in value.items():
            package_id = str(raw_key).strip()
            if not package_id:
                raise ValueError("Quantity keys must be package ids.")
            if isinstance(raw_count, bool) or not isinstance(raw_count, int | float | str):
                raise ValueError(_WHOLE_NUMBER)
            if isinstance(raw_count, float) and not raw_count.is_integer():
                raise ValueError(_WHOLE_NUMBER)
            if isinstance(raw_count, str) and not raw_count.strip().isdigit():
                raise ValueError(_WHOLE_NUMBER)
            count = int(raw_count)
            if count < 1 or count > 100_000:
                raise ValueError("Each quantity must be between 1 and 100,000.")
            counts[package_id] = count
        return counts or None

    @model_validator(mode="after")
    def event_dates_valid(self) -> Self:
        """The event cannot start in the past or end before it starts."""
        _check_event_dates(self.event_date, self.event_end_date)
        return self


class CreateVendorQuoteBody(BaseModel):
    """A vendor's priced quote sent to a client."""

    client_user_id: str = Field(min_length=1)
    conversation_id: str | None = None
    event_name: str = Field(min_length=1, max_length=500)
    event_date: date
    event_end_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    line_items: list[BookingLineItemIn] = Field(min_length=1)

    @model_validator(mode="after")
    def quote_dates_valid(self) -> Self:
        """The event cannot start in the past or end before it starts."""
        _check_event_dates(self.event_date, self.event_end_date)
        return self


class BookingRequestCreated(BaseModel):
    """The new booking's id and status."""

    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    booking_request_id: str = Field(validation_alias="id")
    booking_status: Literal["pending", "accepted", "declined", "cancelled"] = Field(
        default="pending", validation_alias="status"
    )
    created_at: str | None = None
    event_id: str | None = None


# --- vendor views ------------------------------------------------------------------------------------


class VendorBookingListItem(BaseModel):
    """One row of the vendor's bookings list."""

    model_config = ConfigDict(populate_by_name=True)

    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")
    event_name: str
    event_date: str
    event_end_date: str | None = None
    total_label: str
    client_email: str | None = None
    client_display_name: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    client_total_label: str | None = None
    review: VendorReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    payment_status: str = "unpaid"
    has_price_update: bool = False
    completion_waiting_on: Literal["client", "vendor", "both"] | None = None
    vendor_completion_confirmed_at: str | None = None
    event_id: str | None = None
    event_title: str | None = None


class VendorBookingsListResponse(BaseModel):
    """The vendor's bookings, most recently active first."""

    success: bool = True
    bookings: list[VendorBookingListItem]


class VendorBookingDetail(BaseModel):
    """One booking as the vendor sees it."""

    model_config = ConfigDict(populate_by_name=True)

    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")
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
    initial_client_total_label: str | None = None
    client_user_id: str | None = None
    client_email: str | None = None
    client_display_name: str | None = None
    counterparty_phone: str | None = None
    created_at: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    payout_auto_release_at: str | None = None
    completion_waiting_on: Literal["client", "vendor", "both"] | None = None
    review: VendorReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None


class VendorBookingDetailResponse(BaseModel):
    """The vendor's view of one booking."""

    success: bool = True
    booking: VendorBookingDetail


class PutVendorBookingAdjustmentsResponse(BaseModel):
    """The booking after the vendor changed its extras and discounts."""

    success: bool = True
    booking: VendorBookingDetail


class VendorBookingStatusBody(BaseModel):
    """The vendor's answer. Completion is a separate step both parties confirm."""

    model_config = ConfigDict(populate_by_name=True)

    booking_status: Literal["accepted", "declined", "cancelled"] = Field(validation_alias="status")


class VendorBookingStatusResponse(BaseModel):
    """The booking's id and new status."""

    model_config = ConfigDict(populate_by_name=True)

    success: bool = True
    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")


# --- client views ------------------------------------------------------------------------------------


class ClientBookingListItem(BaseModel):
    """One row of the client's bookings list."""

    model_config = ConfigDict(populate_by_name=True)

    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")
    event_name: str
    event_date: str
    event_end_date: str | None = None
    total_label: str
    client_total_label: str | None = None
    vendor_user_id: str
    vendor_display_name: str
    created_at: str | None = None
    updated_at: str | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    has_review: bool = False
    payment_status: str = "unpaid"
    has_price_update: bool = False
    completion_waiting_on: Literal["client", "vendor", "both"] | None = None
    client_completion_confirmed_at: str | None = None
    event_id: str | None = None
    event_title: str | None = None


class ClientBookingsListResponse(BaseModel):
    """The client's bookings, most recently active first."""

    success: bool = True
    bookings: list[ClientBookingListItem]


class ClientBookingDetail(BaseModel):
    """One booking as the client sees it."""

    model_config = ConfigDict(populate_by_name=True)

    booking_request_id: str = Field(validation_alias="id")
    booking_status: str = Field(validation_alias="status")
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
    initial_client_total_label: str | None = None
    created_at: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    payout_auto_release_at: str | None = None
    completion_waiting_on: Literal["client", "vendor", "both"] | None = None
    review: ClientReviewSummary | None = None
    initiator: Literal["client", "vendor"] = "client"
    conversation_id: str | None = None
    event_id: str | None = None
    event_title: str | None = None
    vendor_referral_code: str | None = None
    counterparty_phone: str | None = None


class ClientBookingDetailResponse(BaseModel):
    """The client's view of one booking."""

    success: bool = True
    booking: ClientBookingDetail


class ClientBookingStatusBody(BaseModel):
    """The client's answer to a vendor quote or a vendor's updated price."""

    model_config = ConfigDict(populate_by_name=True)

    booking_status: Literal["accepted", "declined"] = Field(validation_alias="status")
    # The venue, asked for when accepting a vendor quote; ignored when declining.
    event_postcode: str | None = Field(default=None, max_length=16)
    event_address: str | None = Field(default=None, max_length=500)

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalise_postcode(cls, value: object) -> str | None:
        """Collapsed whitespace, or `None` when blank."""
        return _collapsed_postcode(value, min_length=1)

    @field_validator("event_address", mode="before")
    @classmethod
    def normalise_address(cls, value: object) -> str | None:
        """Trimmed text, or `None` when blank."""
        return _stripped_or_none(value)


class UpdateBookingVenueBody(BaseModel):
    """The venue of an accepted, unpaid booking."""

    event_postcode: str | None = Field(default=None, max_length=16)
    event_address: str = Field(min_length=3, max_length=500)

    @field_validator("event_postcode", mode="before")
    @classmethod
    def normalise_postcode(cls, value: object) -> str | None:
        """Collapsed whitespace; anything under two characters is dropped."""
        return _collapsed_postcode(value, min_length=2)

    @field_validator("event_address", mode="before")
    @classmethod
    def normalise_address(cls, value: object) -> str:
        """A trimmed address of at least three characters."""
        if isinstance(value, str) and len(value.strip()) >= 3:
            return value.strip()
        raise ValueError("Enter a full event address.")


class ConfirmCompletionResponse(BaseModel):
    """The booking after one party confirmed the event went ahead."""

    success: bool = True
    id: str
    status: str
    payment_status: str
    awaiting_other_party: bool = False
