"""Admin console API models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AdminDashboardSummary(BaseModel):
    success: bool = True
    users_client: int = 0
    users_vendor: int = 0
    users_admin: int = 0
    vendors_pending: int = 0
    vendors_approved: int = 0
    vendors_banned: int = 0
    bookings_pending: int = 0
    bookings_accepted: int = 0
    bookings_completed: int = 0
    bookings_declined: int = 0
    bookings_cancelled: int = 0
    bookings_paid_count: int = 0
    bookings_needing_support: int = 0
    conversations_count: int = 0
    reviews_count: int = 0


class AdminDashboardTimeBucket(BaseModel):
    date: str
    count: int = 0
    gmv_gbp: float = 0.0


class AdminDashboardSignupBucket(BaseModel):
    date: str
    clients: int = 0
    vendors: int = 0


class AdminDashboardMetrics(BaseModel):
    success: bool = True
    period_days: int = 30
    bookings_created: list[AdminDashboardTimeBucket] = Field(default_factory=list)
    bookings_paid: list[AdminDashboardTimeBucket] = Field(default_factory=list)
    signups: list[AdminDashboardSignupBucket] = Field(default_factory=list)
    open_disputes_count: int = 0


class AdminBookingListSupportSummary(BaseModel):
    needs_attention_count: int = 0
    max_severity: Literal["critical", "warning"] | None = None
    primary_label: str | None = None
    next_action: str | None = None


class AdminBookingListItem(BaseModel):
    id: str
    status: str
    event_name: str
    event_date: str
    client_email: str | None = None
    vendor_email: str | None = None
    vendor_display_name: str
    created_at: str | None = None
    client_total_label: str | None = None
    paid_at: str | None = None
    payment_status: str = "unpaid"
    support: AdminBookingListSupportSummary | None = None


class AdminBookingsListResponse(BaseModel):
    success: bool = True
    bookings: list[AdminBookingListItem]
    total: int = 0
    offset: int = 0
    limit: int = 50


class AdminBookingDetailResponse(BaseModel):
    success: bool = True
    booking: dict[str, Any]


class AdminFinancialsDailyBucket(BaseModel):
    date: str
    count: int = 0
    gmv_gbp: float = 0.0
    platform_fee_gbp: float = 0.0
    vendor_portion_gbp: float = 0.0


class AdminFinancialsSummary(BaseModel):
    success: bool = True
    period_from: str | None = None
    period_to: str | None = None
    paid_booking_count: int = 0
    gmv_gbp: float = 0.0
    platform_fee_gbp: float = 0.0
    vendor_portion_gbp: float = 0.0
    service_fee_percent: float = 0.0
    #: Vendor portion already sent out via Stripe Transfer (payment_status = payout_released).
    payout_released_gbp: float = 0.0
    #: Vendor portion collected but still sitting in Eventtz's Stripe balance (payment_status = paid).
    held_in_platform_balance_gbp: float = 0.0
    daily: list[AdminFinancialsDailyBucket] = Field(default_factory=list)
    disclaimer: str = (
        "Figures derive from stored line items and adjustments plus the configured service fee. "
        "Stripe settlement may differ until payment webhooks persist amounts."
    )


class AdminClientRow(BaseModel):
    user_id: str
    email: str | None = None
    created_at: str | None = None
    account_suspended: bool = False
    booking_count: int = 0


class AdminClientsListResponse(BaseModel):
    success: bool = True
    clients: list[AdminClientRow]


class AdminClientSuspendedBody(BaseModel):
    suspended: bool


class AdminDisputeCase(BaseModel):
    id: str
    booking_request_id: str
    opened_by_user_id: str
    status: Literal["open", "under_review", "resolved", "closed"]
    summary: str
    internal_notes: str | None = None
    resolution_note: str | None = None
    assigned_admin_id: str | None = None
    assigned_admin_email: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    resolved_at: str | None = None
    conversation_id: str | None = None
    #: Money decision recorded when the dispute is resolved (drives a Stripe Transfer or Refund).
    resolution_action: Literal["release_to_vendor", "refund_client", "partial_refund"] | None = None
    refund_amount_gbp: float | None = None
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
    success: bool = True
    disputes: list[AdminDisputeCase]


class AdminDisputePatchBody(BaseModel):
    status: Literal["open", "under_review", "resolved", "closed"] | None = None
    internal_notes: str | None = Field(default=None, max_length=8000)
    resolution_note: str | None = Field(default=None, max_length=8000)
    assigned_admin_id: str | None = None
    #: Money decision — only acted on when status is being set to "resolved".
    resolution_action: Literal["release_to_vendor", "refund_client", "partial_refund"] | None = None
    #: Required (and only used) when resolution_action == "partial_refund".
    refund_amount_gbp: float | None = Field(default=None, gt=0)


class AdminReviewVisibilityBody(BaseModel):
    hidden: bool


class AdminChatMessageItem(BaseModel):
    id: str
    sender_user_id: str
    body: str
    created_at: str | None = None


class AdminConversationMessagesResponse(BaseModel):
    success: bool = True
    conversation_id: str
    messages: list[AdminChatMessageItem]
    client_user_id: str | None = None
    vendor_user_id: str | None = None
    client_email: str | None = None
    vendor_display_name: str | None = None


class AdminAuditLogItem(BaseModel):
    id: str
    admin_user_id: str | None = None
    admin_email: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    payload: dict[str, Any] | None = None
    created_at: str | None = None


class AdminAuditLogResponse(BaseModel):
    success: bool = True
    entries: list[AdminAuditLogItem]
    total: int = 0


class AdminAuditLogDetailResponse(BaseModel):
    success: bool = True
    entry: AdminAuditLogItem


class AdminReviewRow(BaseModel):
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
    success: bool = True
    reviews: list[AdminReviewRow]
    total: int = 0
    offset: int = 0
    limit: int = 100


class AdminReviewDetailResponse(BaseModel):
    success: bool = True
    review: AdminReviewRow


class AdminTeamMember(BaseModel):
    user_id: str
    email: str | None = None
    admin_role: Literal["super_admin", "admin"] = "admin"
    created_at: str | None = None
    account_suspended: bool = False


class AdminTeamListResponse(BaseModel):
    success: bool = True
    members: list[AdminTeamMember]


class AdminTeamInviteBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=128)


class AdminTeamInviteResponse(BaseModel):
    success: bool = True
    user_id: str
    email: str
    admin_role: Literal["super_admin", "admin"] = "admin"
    created: bool = False
    message: str


class AdminTeamPatchBody(BaseModel):
    admin_role: Literal["super_admin", "admin"] | None = None
    account_suspended: bool | None = None


class AdminBookingPaymentPatchBody(BaseModel):
    stripe_payment_intent_id: str | None = None
    stripe_charge_id: str | None = None
    payment_amount_gbp: float | None = None


class AdminCancelOnBehalfBody(BaseModel):
    party: Literal["client", "vendor"]
    reason: str = Field(min_length=3, max_length=2000)


class AdminConfirmCompletionBody(BaseModel):
    party: Literal["client", "vendor"]


class AdminSupportHoldBody(BaseModel):
    hold: bool
