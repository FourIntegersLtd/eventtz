"""Staff-checked public liability insurance on vendors

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-17

Catering and baking vendors must hold public liability
cover (`vendors/domain_insurance.py`). The vendor uploads the certificate in the profile
form; these columns hold what staff read off it, so the vendor cannot write them:

- `insurance_certificate_url`, `insurance_expires_on`, `insurance_cover_gbp`,
  `insurance_verified_at`, `insurance_verified_by`: the checked certificate.
- `insurance_reminder_at`: the one renew-or-upload email per certificate.

Additive and nullable: no data changes. Every existing vendor reads as unchecked.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

VENDOR_COLUMNS = (
    sa.Column(
        "insurance_certificate_url",
        sa.Text(),
        nullable=True,
        comment="The public liability certificate staff checked (the payload upload at the time).",
    ),
    sa.Column(
        "insurance_expires_on",
        sa.Date(),
        nullable=True,
        comment="When the checked public liability cover ends, as staff read it off the certificate.",
    ),
    sa.Column(
        "insurance_cover_gbp",
        sa.Integer(),
        nullable=True,
        comment="The checked public liability cover, in whole pounds.",
    ),
    sa.Column(
        "insurance_verified_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When staff checked the certificate.",
    ),
    sa.Column(
        "insurance_verified_by",
        sa.Uuid(),
        nullable=True,
        comment="The staff member who checked the certificate.",
    ),
    sa.Column(
        "insurance_reminder_at",
        sa.DateTime(timezone=True),
        nullable=True,
        comment="When the renew-or-upload insurance email was sent; cleared when a certificate is checked.",
    ),
)


def upgrade() -> None:
    """Add the insurance columns to `vendors`."""
    for new_column in VENDOR_COLUMNS:
        op.add_column("vendors", new_column)


def downgrade() -> None:
    """Drop the insurance columns."""
    for dropped_column in reversed(VENDOR_COLUMNS):
        op.drop_column("vendors", dropped_column.name)
