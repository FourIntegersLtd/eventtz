"""Request bodies and responses for the admin bookings console and financials screens.

Field names and the disclaimer text are the baseline's (`contracts/admin.py`),
because the web admin app reads them directly.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.bookings.domain_financials import DISCLAIMER
from app.features.bookings.schemas_terms import BookingTermsFields


class AdminBookingListSupportSummary(BaseModel):
    """The worst thing wrong with a booking, for one row of the admin list."""

    needs_attention_count: int = 0
    max_severity: Literal["critical", "warning"] | None = None
    primary_label: str | None = None
    next_action: str | None = None


class AdminBookingListItem(BaseModel):
    """One row of the admin bookings list."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    status: str
    event_name: str
    event_date: str
    client_email: str | None = None
    vendor_email: str | None = None
    vendor_display_name: str = "Vendor"
    created_at: str | None = None
    client_total_label: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    support: AdminBookingListSupportSummary | None = None


class AdminBookingsListResponse(BaseModel):
    """A page of the admin bookings list."""

    success: bool = True
    bookings: list[AdminBookingListItem]
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


class AdminBookingNeedsAttentionFlag(BaseModel):
    """One diagnostic flag on a booking, and how urgent it is."""

    code: str
    severity: Literal["critical", "warning"]
    label: str


class AdminBookingSupportMeta(BaseModel):
    """The admin detail screen's diagnostics block for one booking."""

    needs_attention: list[AdminBookingNeedsAttentionFlag] = Field(default_factory=list)
    open_dispute: dict[str, Any] | None = None
    support_hold: bool = False
    vendor_stripe_payouts_enabled: bool = False
    next_action: str | None = None


class AdminBookingDetail(BookingTermsFields):
    """One booking as the admin console sees it: every column, resolved party details and its terms."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    status: str
    event_name: str
    event_date: str
    event_end_date: str | None = None
    event_postcode: str | None = None
    event_address: str | None = None
    notes: str | None = None
    total_label: str
    selected_option_ids: list[str] = Field(default_factory=list)
    line_items: list[Any] = Field(default_factory=list)
    vendor_adjustments: list[Any] = Field(default_factory=list)
    client_email: str | None = None
    vendor_email: str | None = None
    vendor_user_id: str
    client_user_id: str
    vendor_display_name: str = "Vendor"
    created_at: str | None = None
    paid_at: str | None = None
    stripe_payment_intent_id: str | None = None
    stripe_charge_id: str | None = None
    stripe_checkout_session_id: str | None = None
    payment_amount_gbp: float | None = None
    payment_status: str = "unpaid"
    vendor_amount_gbp: float | None = None
    platform_fee_gbp: float | None = None
    stripe_transfer_id: str | None = None
    payout_released_at: str | None = None
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    cancellation_policy: str | None = None
    cancellation_refund_percent: int | None = None
    cancellation_refund_gbp: float | None = None
    cancellation_vendor_share_gbp: float | None = None
    cancellation_payout_at: str | None = None
    support: AdminBookingSupportMeta


class AdminBookingDetailResponse(BaseModel):
    """One booking, admin-eyes view."""

    success: bool = True
    booking: AdminBookingDetail


class AdminPaymentFieldsPatchBody(BaseModel):
    """The Stripe ids and amount a super admin may set by hand, after verifying them with Stripe.

    Only the fields actually sent are applied (`exclude_unset`); this model sets
    no defaults that would look like an intentional blank-out.
    """

    stripe_payment_intent_id: str | None = None
    stripe_charge_id: str | None = None
    payment_amount_gbp: float | None = None


class AdminPaymentFieldsPatchResponse(BaseModel):
    """Acknowledges the payment-fields patch."""

    success: bool = True


class AdminSupportHoldBody(BaseModel):
    """Pause or resume a booking's automatic payout release."""

    hold: bool


class AdminFinancialsDailyBucket(BaseModel):
    """One day's totals in the financials chart."""

    date: str
    count: int = 0
    gmv_gbp: float = 0.0
    platform_fee_gbp: float = 0.0
    vendor_portion_gbp: float = 0.0


class AdminFinancialsDailyListResponse(BaseModel):
    """One page of daily buckets for the financials table."""

    success: bool = True
    daily: list[AdminFinancialsDailyBucket] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


class AdminFinancialsSummary(BaseModel):
    """Totals for the admin financials screen, over an optional date range."""

    success: bool = True
    period_from: str | None = None
    period_to: str | None = None
    paid_booking_count: int = 0
    gmv_gbp: float = 0.0
    platform_fee_gbp: float = 0.0
    vendor_portion_gbp: float = 0.0
    service_fee_percent: float = 0.0
    payout_released_gbp: float = 0.0
    held_in_platform_balance_gbp: float = 0.0
    daily: list[AdminFinancialsDailyBucket] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER
