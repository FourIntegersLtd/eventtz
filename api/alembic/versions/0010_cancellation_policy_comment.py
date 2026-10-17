"""The cancellation_policy column comment no longer promises a full refund when it is NULL

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-17

0006 described a NULL `booking_requests.cancellation_policy` as a booking paid before presets
existed, refunded in full. No booking was ever paid before presets, so that rule was removed: NULL
now only means checkout has not copied the vendor's preset yet, and the code reads it as the
default preset. Comment-only; no data changes.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_COMMENT = "Cancellation preset copied at checkout (flexible/moderate/strict); NULL until then."
OLD_COMMENT = "Cancellation preset copied at checkout (flexible/moderate/strict); NULL = full refund."


def upgrade() -> None:
    """Rewrite the column comment."""
    op.alter_column(
        "booking_requests",
        "cancellation_policy",
        existing_type=sa.Text(),
        existing_nullable=True,
        comment=NEW_COMMENT,
        existing_comment=OLD_COMMENT,
    )


def downgrade() -> None:
    """Restore the 0006 comment."""
    op.alter_column(
        "booking_requests",
        "cancellation_policy",
        existing_type=sa.Text(),
        existing_nullable=True,
        comment=OLD_COMMENT,
        existing_comment=NEW_COMMENT,
    )
