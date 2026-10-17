"""Terms remediation: Terms acceptance, payment deadline, no-show, date changes, delivery split, deposits

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-17

Every schema change the Terms of Service rewrite needs, in one revision so the
slices could be built in parallel (`docs/plans/terms-remediation-2026-10-17.md`):

- `users.terms_*`: which version of the Terms a person accepted and when, and the
  version whose change notice they were last emailed (sent once per version).
- `booking_requests.cancellation_reason`: `exceptional` marks a staff cancel for
  exceptional circumstances, which never counts against the vendor.
- `booking_requests.report_window_hours`: how long after the event the client has
  to report a problem before the payout is released, copied at checkout from the
  vendor's categories (rentals and decor get longer, for collection).
- `booking_requests.payout_upfront_percent` and the `upfront_*` / `delivery_*`
  columns: photography and video vendors are paid part on completion and the rest
  once the client confirms delivery, or the delivery deadline passes.
- `booking_requests.proposed_event_*` and `date_change_*`: one open request to move
  the date, which the other party accepts or declines.
- `booking_requests.damage_deposit_gbp` and the `deposit_*` columns: a refundable
  deposit for rentals and decor, charged with the booking and returned after the
  event unless the vendor claims part of it.
- `vendors.listing_paused_until`: a timed listing pause staff can set after
  repeated vendor cancellations; the listing comes back on its own.

The CHECK constraints gain the new values: `cancelled_by = 'system'` (an unpaid
booking expired at its payment deadline), `failure_reason = 'PAYMENT_DEADLINE'`,
the dispute outcome `vendor_no_show`, and the new notification kinds.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_COLUMNS = (
    sa.Column(
        "terms_accepted_version",
        sa.Text(),
        nullable=True,
        comment="Version (effective date) of the Terms of Service the person last accepted.",
    ),
    sa.Column(
        "terms_accepted_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When they accepted terms_accepted_version.",
    ),
    sa.Column(
        "terms_notice_sent_version",
        sa.Text(),
        nullable=True,
        comment="Terms version whose change notice was last emailed to them (one email per version).",
    ),
)

BOOKING_COLUMNS = (
    sa.Column(
        "cancellation_reason",
        sa.Text(),
        nullable=True,
        comment="Why staff cancelled; 'exceptional' = exceptional circumstances, never held against the vendor.",
    ),
    sa.Column(
        "report_window_hours",
        sa.SmallInteger(),
        nullable=True,
        comment="Hours after the event to report a problem before payout, copied at checkout; NULL = default.",
    ),
    sa.Column(
        "payout_upfront_percent",
        sa.SmallInteger(),
        nullable=True,
        comment="Percent of the vendor's price paid on completion; the rest after delivery. NULL = no split.",
    ),
    sa.Column(
        "delivery_deadline_days",
        sa.SmallInteger(),
        nullable=True,
        comment="Days after the event the vendor has to deliver (photos, video) before the rest is released.",
    ),
    sa.Column(
        "upfront_amount_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="The upfront part of the vendor's price, fixed when the client paid.",
    ),
    sa.Column(
        "upfront_transfer_id",
        sa.Text(),
        nullable=True,
        comment="Stripe Transfer id of the upfront part.",
    ),
    sa.Column(
        "upfront_payout_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the upfront part was transferred to the vendor.",
    ),
    sa.Column(
        "delivery_confirmed_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the client confirmed they received the delivery (releases the rest).",
    ),
    sa.Column(
        "proposed_event_date",
        sa.Date(),
        nullable=True,
        comment="New first day asked for in an open date-change request.",
    ),
    sa.Column(
        "proposed_event_end_date",
        sa.Date(),
        nullable=True,
        comment="New last day asked for in an open date-change request (multi-day events).",
    ),
    sa.Column(
        "date_change_requested_by",
        sa.Text(),
        nullable=True,
        comment="client or vendor: who asked to move the date. NULL = no open request.",
    ),
    sa.Column(
        "date_change_requested_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the open date-change request was made.",
    ),
    sa.Column(
        "date_change_note",
        sa.Text(),
        nullable=True,
        comment="Optional message sent with the date-change request.",
    ),
    sa.Column(
        "damage_deposit_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="Refundable damage deposit charged with the booking (rentals, decor). NULL = none.",
    ),
    sa.Column(
        "deposit_refunded_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the deposit (or what was left of it after a claim) went back to the client.",
    ),
    sa.Column(
        "deposit_claim_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="How much of the deposit the vendor claimed for damage or loss.",
    ),
    sa.Column(
        "deposit_claim_note",
        sa.Text(),
        nullable=True,
        comment="The vendor's description of the damage or loss.",
    ),
    sa.Column(
        "deposit_claimed_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the vendor made the deposit claim.",
    ),
    sa.Column(
        "deposit_claim_awarded_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="What staff awarded the vendor from the deposit; the rest is refunded.",
    ),
    sa.Column(
        "deposit_claim_resolved_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When staff decided the deposit claim.",
    ),
    sa.Column(
        "deposit_transfer_id",
        sa.Text(),
        nullable=True,
        comment="Stripe Transfer id of the deposit amount awarded to the vendor.",
    ),
)

VENDOR_COLUMNS = (
    sa.Column(
        "listing_paused_until",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="Staff paused the listing until this time (repeated cancellations); it returns on its own.",
    ),
    sa.Column(
        "listing_pause_reason",
        sa.Text(),
        nullable=True,
        comment="The reason sent to the vendor when the listing was paused.",
    ),
)

OLD_NOTIFICATION_KINDS = (
    "booking_accepted",
    "booking_completed",
    "booking_declined_by_vendor",
    "booking_request_received",
    "booking_request_sent",
    "booking_cancelled_by_client",
    "booking_cancelled_by_vendor",
    "booking_pricing_updated",
    "client_confirmed_updated_price",
    "client_declined_updated_price",
    "vendor_quote_received",
    "vendor_quote_accepted",
    "vendor_quote_declined",
    "vendor_quote_withdrawn",
    "payment_received",
    "vendor_payment_received",
    "vendor_payout_released",
    "payment_refunded",
    "completion_confirmed_awaiting_other_party",
    "completion_reminder",
    "vendor_completion_reminder",
    "enquiry_reminder_1h",
    "enquiry_reminder_6h",
    "enquiry_reminder_24h",
    "client_vendor_no_response",
    "event_tomorrow",
    "vendor_event_tomorrow",
    "pay_to_confirm",
    "payout_held_connect_incomplete",
)
NEW_NOTIFICATION_KINDS = (
    "booking_payment_expired",
    "booking_cancelled_by_eventtz",
    "date_change_requested",
    "date_change_accepted",
    "date_change_declined",
    "date_change_withdrawn",
    "delivery_confirmed",
    "deposit_refunded",
    "deposit_claim_opened",
    "deposit_claim_resolved",
    "vendor_deposit_claim_resolved",
    "vendor_booking_payment_expired",
    "awaiting_delivery",
    "vendor_upfront_released",
    "vendor_final_released",
)

OLD_FAILURE_REASONS = (
    "NO_VENDOR_AVAILABLE",
    "VENDOR_UNAVAILABLE",
    "VENDOR_NO_RESPONSE",
    "PRICE_TOO_HIGH",
    "CUSTOMER_CANCELLED",
    "PAYMENT_FAILED",
    "OTHER",
)


def _in_list(column: str, values: Sequence[str], *, nullable: bool) -> str:
    """A CHECK expression allowing `values` (and NULL when `nullable`)."""
    quoted = ", ".join(f"'{value}'::text" for value in values)
    allowed = f"{column} = ANY (ARRAY[{quoted}])"
    return f"({column} IS NULL) OR ({allowed})" if nullable else allowed


# (table, constraint name, column, old values, new values, nullable)
CHANGED_CHECKS = (
    (
        "booking_requests",
        "booking_requests_cancelled_by_check",
        "cancelled_by",
        ("client", "vendor"),
        ("client", "vendor", "system"),
        True,
    ),
    (
        "booking_requests",
        "booking_requests_failure_reason_check",
        "failure_reason",
        OLD_FAILURE_REASONS,
        (*OLD_FAILURE_REASONS, "PAYMENT_DEADLINE"),
        True,
    ),
    (
        "dispute_cases",
        "dispute_cases_resolution_action_check",
        "resolution_action",
        ("release_to_vendor", "refund_client", "partial_refund"),
        ("release_to_vendor", "refund_client", "partial_refund", "vendor_no_show"),
        True,
    ),
    (
        "booking_notifications",
        "booking_notifications_kind_check",
        "kind",
        OLD_NOTIFICATION_KINDS,
        (*OLD_NOTIFICATION_KINDS, *NEW_NOTIFICATION_KINDS),
        False,
    ),
)

# New CHECK constraints on the new columns: (name, expression).
NEW_BOOKING_CHECKS = (
    (
        "booking_requests_cancellation_reason_check",
        "(cancellation_reason IS NULL) OR (cancellation_reason = 'exceptional'::text)",
    ),
    (
        "booking_requests_date_change_requested_by_check",
        "(date_change_requested_by IS NULL) OR (date_change_requested_by = ANY (ARRAY['client'::text, 'vendor'::text]))",
    ),
    (
        "booking_requests_payout_upfront_percent_check",
        "(payout_upfront_percent IS NULL) OR ((payout_upfront_percent >= 1) AND (payout_upfront_percent <= 99))",
    ),
    (
        "booking_requests_delivery_deadline_days_check",
        "(delivery_deadline_days IS NULL) OR ((delivery_deadline_days >= 1) AND (delivery_deadline_days <= 366))",
    ),
    (
        "booking_requests_damage_deposit_check",
        "(damage_deposit_gbp IS NULL) OR (damage_deposit_gbp >= (0)::numeric)",
    ),
)


def upgrade() -> None:
    """Add the new columns and widen the CHECK constraints.

    `op.f` keeps the baseline's constraint names as they are, past the naming convention.
    """
    for new_column in USER_COLUMNS:
        op.add_column("users", new_column)
    for new_column in BOOKING_COLUMNS:
        op.add_column("booking_requests", new_column)
    for new_column in VENDOR_COLUMNS:
        op.add_column("vendors", new_column)
    for table, name, column, _old_values, new_values, nullable in CHANGED_CHECKS:
        op.drop_constraint(op.f(name), table, type_="check")
        op.create_check_constraint(op.f(name), table, _in_list(column, new_values, nullable=nullable))
    for name, expression in NEW_BOOKING_CHECKS:
        op.create_check_constraint(op.f(name), "booking_requests", expression)


def downgrade() -> None:
    """Narrow the CHECK constraints back (rows using the new values must be gone) and drop the columns."""
    for name, _expression in reversed(NEW_BOOKING_CHECKS):
        op.drop_constraint(op.f(name), "booking_requests", type_="check")
    for table, name, column, old_values, _new_values, nullable in reversed(CHANGED_CHECKS):
        op.drop_constraint(op.f(name), table, type_="check")
        op.create_check_constraint(op.f(name), table, _in_list(column, old_values, nullable=nullable))
    for new_column in reversed(VENDOR_COLUMNS):
        op.drop_column("vendors", new_column.name)
    for new_column in reversed(BOOKING_COLUMNS):
        op.drop_column("booking_requests", new_column.name)
    for new_column in reversed(USER_COLUMNS):
        op.drop_column("users", new_column.name)
