"""Tables owned by `bookings`: one row per booking request, from enquiry to payout.

Only this slice's repositories import this class. It mirrors the baseline schema
(Alembic 0002); `alembic check` fails when the two drift apart. CHECK constraints
(status, payment status, initiator, failure reasons, no self-booking) and the two
triggers (daily capacity, `updated_at`) live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CHAR,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class BookingRequest(Base, UUIDPrimaryKey):
    """One booking between a client and a vendor.

    `status` is the request's lifecycle (pending → accepted → completed, or declined
    / cancelled); `payment_status` is the money's, and only payments writes it.
    """

    __tablename__ = "booking_requests"
    __table_args__ = (
        Index("idx_booking_requests_accepted_at", text("accepted_at DESC NULLS LAST")),
        Index("idx_booking_requests_client", "client_user_id"),
        Index(
            "idx_booking_requests_client_event",
            "client_user_id",
            "event_id",
            postgresql_where=text("event_id IS NOT NULL"),
        ),
        Index(
            "idx_booking_requests_completion_pending",
            "event_date",
            postgresql_where=text("(status = 'accepted'::text) AND (payment_status = 'paid'::text)"),
        ),
        Index(
            "idx_booking_requests_conversation",
            "conversation_id",
            postgresql_where=text("conversation_id IS NOT NULL"),
        ),
        Index("idx_booking_requests_created_at", text("created_at DESC")),
        Index(
            "idx_booking_requests_enquiry_reminders_pending",
            "created_at",
            postgresql_where=text(
                "(status = 'pending'::text) AND (initiator = 'client'::text) "
                "AND (vendor_first_response_at IS NULL)"
            ),
        ),
        Index(
            "idx_booking_requests_failure_reason",
            "failure_reason",
            postgresql_where=text("failure_reason IS NOT NULL"),
        ),
        Index("idx_booking_requests_payment_status", "payment_status"),
        Index("idx_booking_requests_status_payment", "status", "payment_status"),
        Index(
            "idx_booking_requests_stripe_checkout_session_id",
            "stripe_checkout_session_id",
            postgresql_where=text("stripe_checkout_session_id IS NOT NULL"),
        ),
        Index("idx_booking_requests_updated_at", text("updated_at DESC")),
        Index("idx_booking_requests_vendor", "vendor_user_id"),
        Index(
            "idx_booking_requests_vendor_active_dates",
            "vendor_user_id",
            "event_date",
            "event_end_date",
            postgresql_where=text("status = ANY (ARRAY['pending'::text, 'accepted'::text])"),
        ),
        Index("idx_booking_requests_vendor_created", "vendor_user_id", text("created_at DESC")),
        Index(
            "idx_booking_requests_vendor_first_response_at", text("vendor_first_response_at DESC NULLS LAST")
        ),
        Index(
            "idx_booking_requests_vendor_referral_code",
            "vendor_referral_code",
            postgresql_where=text("vendor_referral_code IS NOT NULL"),
        ),
        {
            "comment": (
                "Client-initiated booking enquiry; line_items/selected_option_ids snapshot vendor payload ids."  # noqa: E501 (verbatim DB comment)
            )
        },
    )

    client_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="booking_requests_client_user_id_fkey", ondelete="RESTRICT"),
        nullable=False,
    )
    vendor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="booking_requests_vendor_user_id_fkey", ondelete="RESTRICT"),
        nullable=False,
    )
    event_name: Mapped[str] = mapped_column(Text, nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_end_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'::text"))
    selected_option_ids: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    line_items: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    total_label: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Kept current by the `trg_booking_requests_updated_at` trigger.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="Set automatically when payment succeeds (e.g. Stripe). Not used for manual confirmation.",
    )
    vendor_adjustments: Mapped[Any] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        comment=(
            "Array of {id, tag, label, amount_gbp} - additions (positive) or discounts (negative) "
            "before accept; client total includes Eventtz service fee on top."
        ),
    )
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        Text, comment="Stripe PaymentIntent id when checkout is integrated."
    )
    stripe_charge_id: Mapped[str | None] = mapped_column(Text)
    payment_amount_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="Captured payment amount in GBP when known."
    )
    initiator: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'client'::text"),
        comment="client = enquiry from explore; vendor = custom quote sent to client (client accepts pending).",  # noqa: E501 (verbatim DB comment)
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("conversations.id", name="booking_requests_conversation_id_fkey", ondelete="SET NULL"),
        comment="Optional chat thread the quote was sent from.",
    )
    event_postcode: Mapped[str | None] = mapped_column(
        Text, comment="Venue/event location postcode supplied by the client when requesting a booking."
    )
    event_address: Mapped[str | None] = mapped_column(
        Text,
        comment="Optional formatted venue address line(s); event_postcode is still required for client requests.",  # noqa: E501 (verbatim DB comment)
    )
    payment_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'unpaid'::text"),
        comment=(
            "Money lifecycle, independent of status: unpaid -> pending -> paid -> payout_released, "
            "or refunded/partially_refunded via disputes."
        ),
    )
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(Text)
    vendor_amount_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        comment="Vendor portion snapshot at payment time (does not move if pricing edits happen later).",
    )
    platform_fee_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="Eventtz service fee snapshot at payment time."
    )
    stripe_transfer_id: Mapped[str | None] = mapped_column(
        Text, comment="Stripe Transfer id once the vendor payout has been released."
    )
    payout_released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_completion_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="Client confirmed the event/booking is complete."
    )
    vendor_completion_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="Vendor confirmed the event/booking is complete. Both set -> status=completed + payout released.",  # noqa: E501 (verbatim DB comment)
    )
    initial_client_total_label: Mapped[str | None] = mapped_column(
        Text,
        comment="Client total incl. service fee at request creation; used when vendor sends an updated price.",  # noqa: E501 (verbatim DB comment)
    )
    cancelled_by: Mapped[str | None] = mapped_column(
        Text, comment="Who cancelled the booking (client or vendor). Null unless status = cancelled."
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the booking was cancelled."
    )
    # A client cancel of a paid booking splits the money by the vendor's preset (migration 0006,
    # `domain_cancellation.py`). NULL policy = paid before presets existed = full refund.
    cancellation_policy: Mapped[str | None] = mapped_column(
        Text,
        comment="Cancellation preset copied at checkout (flexible/moderate/strict); NULL = full refund.",
    )
    cancellation_refund_percent: Mapped[int | None] = mapped_column(
        SmallInteger, comment="Percent of the vendor's price refunded when the client cancelled."
    )
    cancellation_refund_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        comment="What the client got back on cancel (the full service fee plus the tier's share).",
    )
    cancellation_vendor_share_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="What the vendor keeps from a client cancel; 0 when refunded in full."
    )
    cancellation_payout_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the vendor's cancellation share was transferred; NULL while it is still held.",
    )
    # Terms remediation (migration 0007). Staff cancel reason, the per-category reporting window,
    # the photography/video delivery split, date-change requests and damage deposits.
    cancellation_reason: Mapped[str | None] = mapped_column(
        Text,
        comment="Why staff cancelled; 'exceptional' = exceptional circumstances, never held against the vendor.",  # noqa: E501 (verbatim DB comment)
    )
    report_window_hours: Mapped[int | None] = mapped_column(
        SmallInteger,
        comment="Hours after the event to report a problem before payout, copied at checkout; NULL = default.",  # noqa: E501 (verbatim DB comment)
    )
    payout_upfront_percent: Mapped[int | None] = mapped_column(
        SmallInteger,
        comment="Percent of the vendor's price paid on completion; the rest after delivery. NULL = no split.",
    )
    delivery_deadline_days: Mapped[int | None] = mapped_column(
        SmallInteger,
        comment="Days after the event the vendor has to deliver (photos, video) before the rest is released.",
    )
    upfront_amount_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="The upfront part of the vendor's price, fixed when the client paid."
    )
    upfront_transfer_id: Mapped[str | None] = mapped_column(
        Text, comment="Stripe Transfer id of the upfront part."
    )
    upfront_payout_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the upfront part was transferred to the vendor."
    )
    delivery_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the client confirmed they received the delivery (releases the rest).",
    )
    proposed_event_date: Mapped[date | None] = mapped_column(
        Date, comment="New first day asked for in an open date-change request."
    )
    proposed_event_end_date: Mapped[date | None] = mapped_column(
        Date, comment="New last day asked for in an open date-change request (multi-day events)."
    )
    date_change_requested_by: Mapped[str | None] = mapped_column(
        Text, comment="client or vendor: who asked to move the date. NULL = no open request."
    )
    date_change_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the open date-change request was made."
    )
    date_change_note: Mapped[str | None] = mapped_column(
        Text, comment="Optional message sent with the date-change request."
    )
    damage_deposit_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        comment="Refundable damage deposit charged with the booking (rentals, decor). NULL = none.",
    )
    deposit_refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the deposit (or what was left of it after a claim) went back to the client.",
    )
    deposit_claim_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="How much of the deposit the vendor claimed for damage or loss."
    )
    deposit_claim_note: Mapped[str | None] = mapped_column(
        Text, comment="The vendor's description of the damage or loss."
    )
    deposit_claimed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the vendor made the deposit claim."
    )
    deposit_claim_awarded_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="What staff awarded the vendor from the deposit; the rest is refunded."
    )
    deposit_claim_resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When staff decided the deposit claim."
    )
    deposit_transfer_id: Mapped[str | None] = mapped_column(
        Text, comment="Stripe Transfer id of the deposit amount awarded to the vendor."
    )
    payout_auto_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment=(
            "Set when the vendor payout was released automatically 48h after the event "
            "(no mutual confirmation)."
        ),
    )
    completion_reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment=(
            "Set once the post-event confirm-completion reminder batch has been sent "
            "for this booking (dedupe)."
        ),
    )
    support_hold: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="When true, blocks automatic payout release until cleared by support.",
    )
    currency: Mapped[str] = mapped_column(
        CHAR(3),
        nullable=False,
        server_default=text("'GBP'::bpchar"),
        comment="ISO 4217 currency for this booking (defaults to GBP for UK launch).",
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the vendor accepted (enquiry → bookable). Set once."
    )
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vendor_first_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="First meaningful vendor response (message, accept, or decline). Set once.",
    )
    vendor_response_time_seconds: Mapped[int | None] = mapped_column(Integer)
    payment_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vendor_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(
        Text, comment="Analytics outcome for unfulfilled demand; does not replace status."
    )
    failure_noted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    enquiry_reminder_1h_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the 1h vendor reply reminder was sent (pending client-initiated enquiries).",
    )
    enquiry_reminder_6h_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the 6h vendor reply reminder was sent."
    )
    enquiry_reminder_24h_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the 24h vendor reply reminder was sent."
    )
    client_no_response_nudge_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the client received the 24h “try other vendors” email/notification.",
    )
    client_search_context: Mapped[Any | None] = mapped_column(
        JSONB,
        comment=(
            "Marketplace search filters at enquire time (types, location, dates, q, country) "
            "for alternative suggestions."
        ),
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("client_events.id", name="booking_requests_event_id_fkey", ondelete="SET NULL"),
        comment="Optional link to client_events for multi-vendor planning under one celebration.",
    )
    stripe_receipt_url: Mapped[str | None] = mapped_column(
        Text, comment="Stripe Charge.receipt_url snapshot at payment time (client card receipt)."
    )
    payment_receipt_snapshot: Mapped[Any | None] = mapped_column(
        JSONB, comment="Frozen client payment receipt JSON at checkout; write-once."
    )
    vendor_payment_record_snapshot: Mapped[Any | None] = mapped_column(
        JSONB, comment="Frozen vendor payment record JSON when client pays; write-once."
    )
    vendor_payout_statement_snapshot: Mapped[Any | None] = mapped_column(
        JSONB, comment="Frozen vendor payout statement JSON when transfer succeeds; write-once."
    )
    event_tomorrow_reminded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the day-before event reminder was sent to client and vendor."
    )
    pay_to_confirm_reminded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the client was reminded to pay after the vendor accepted."
    )
    vendor_referral_code: Mapped[str | None] = mapped_column(
        Text, comment="Vendor client referral code applied at enquiry (nullable)."
    )
    service_fee_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("5.00"),
        comment="Snapshotted platform service fee % for this booking (always 5; referral uses fixed GBP discount).",  # noqa: E501 (verbatim DB comment)
    )
    referral_fee_discount_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        comment="GBP discount applied to Eventtz service fee via vendor client referral tier (snapshot at payment).",  # noqa: E501 (verbatim DB comment)
    )
