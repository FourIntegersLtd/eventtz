"""Tiered client-cancellation refunds: the vendor's policy snapshot and the split taken at cancel

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-17

A vendor picks a cancellation preset (`vendors.payload.cancellationPolicy`); the key
is copied onto the booking when the client opens Checkout, so the terms the client
agreed to are the ones applied later, whatever the vendor changes in between. A
client cancel then refunds a percentage of the vendor's price (the Eventtz fee is
always refunded) and pays the vendor the rest at once. The four `cancellation_*`
money columns record that split; `cancellation_payout_at` is NULL until the vendor's
share has actually been transferred (their Stripe account may not be ready yet).

Bookings paid before this revision keep a NULL policy, which the code reads as a
full refund: that is what their Terms said.

`vendors.cancellation_policy_nudge_at` records the one email asking an approved vendor
who has not chosen a preset to pick one (clients see Flexible until they do), and
`cancellation_policy_reminder_at` the single follow-up 14 days later.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_COLUMNS = (
    sa.Column(
        "cancellation_policy",
        sa.Text(),
        nullable=True,
        comment="Cancellation preset copied at checkout (flexible/moderate/strict); NULL = full refund.",
    ),
    sa.Column(
        "cancellation_refund_percent",
        sa.SmallInteger(),
        nullable=True,
        comment="Percent of the vendor's price refunded when the client cancelled.",
    ),
    sa.Column(
        "cancellation_refund_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="What the client got back on cancel (the full service fee plus the tier's share).",
    ),
    sa.Column(
        "cancellation_vendor_share_gbp",
        sa.Numeric(12, 2),
        nullable=True,
        comment="What the vendor keeps from a client cancel; 0 when refunded in full.",
    ),
    sa.Column(
        "cancellation_payout_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the vendor's cancellation share was transferred; NULL while it is still held.",
    ),
)


VENDOR_NUDGE_COLUMNS = (
    sa.Column(
        "cancellation_policy_nudge_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the one choose-your-cancellation-policy email was sent.",
    ),
    sa.Column(
        "cancellation_policy_reminder_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the one follow-up was sent, 14 days after the first email, if still no preset.",
    ),
)


def upgrade() -> None:
    """Add the cancellation columns to `booking_requests` and the nudge marker to `vendors`."""
    for new_column in NEW_COLUMNS:
        op.add_column("booking_requests", new_column)
    for new_column in VENDOR_NUDGE_COLUMNS:
        op.add_column("vendors", new_column)


def downgrade() -> None:
    """Drop the cancellation columns and the nudge marker."""
    for new_column in reversed(VENDOR_NUDGE_COLUMNS):
        op.drop_column("vendors", new_column.name)
    for new_column in reversed(NEW_COLUMNS):
        op.drop_column("booking_requests", new_column.name)
