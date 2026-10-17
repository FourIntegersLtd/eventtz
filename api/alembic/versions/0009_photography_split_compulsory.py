"""Help Centre articles: every photography booking is paid in two parts, the first 50-60%

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-17

0008 described the two-part payout as optional, with a first part of 50-80%. It is now compulsory for
photography, capped at 60%, with 60% / 30 days when the vendor sets nothing (ADR 0010, amended).
Only the affected sentences change, by exact text replacement; downgrade swaps them back.

The numbers here are copied from web/lib/policyConstants.json; change both together.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (article slug, column, text written by 0008, text this revision writes)
REPLACEMENTS: tuple[tuple[str, str, str, str], ...] = (
    (
        "vendor-package-quality",
        "body_md",
        "## Optional booking rules\nOn **Pricing** you can also set:\n",
        "## Deposits and two-part payouts\nOn **Pricing** you can also set:\n",
    ),
    (
        "vendor-package-quality",
        "body_md",
        "- **Two-part payout** (photos and video only). Choose how much is paid after the event, "
        "between **50%** and **80%**, and a delivery deadline of up to **60 days**.",
        "- **Two-part payout** (photos and video, every booking). Choose how much is paid after the "
        "event, between **50%** and **60%**, and a delivery deadline of up to **60 days**. If you leave "
        "them blank, we use **60%** and **30 days**.",
    ),
    (
        "vendor-package-quality",
        "summary",
        "Build clear packages, set optional deposits or two-part payouts, "
        "and use AI tools on Pricing and Review.",
        "Build clear packages, set deposits and two-part payouts, and use AI tools on Pricing and Review.",
    ),
    (
        "vendor-when-get-paid",
        "body_md",
        "Photographers and videographers can choose to be paid in two parts. "
        "You pick the first part (between **50%** and **80%**), paid after the "
        "event.",
        "Photographers and videographers are always paid in two parts. "
        "You pick the first part (between **50%** and **60%**, or **60%** if you "
        "leave it blank), paid after the event.",
    ),
    (
        "vendor-when-get-paid",
        "body_md",
        "or video, or on your delivery deadline (up to **60 days**) if they have not reported a problem.",
        "or video, or on your delivery deadline (up to **60 days**, or **30 days** "
        "if you leave it blank) if they have not reported a problem.",
    ),
)


# One fixed statement per column, so no SQL is built from strings.
STATEMENTS: dict[str, str] = {
    "body_md": "UPDATE public.help_articles SET body_md = replace(body_md, :old_text, :new_text),"
    " updated_at = now() WHERE slug = :slug",
    "summary": "UPDATE public.help_articles SET summary = replace(summary, :old_text, :new_text),"
    " updated_at = now() WHERE slug = :slug",
}


def _replace(column: str, slug: str, old_text: str, new_text: str) -> None:
    """Swap one exact passage in one article column; a no-op when the passage is not there."""
    statement = sa.text(STATEMENTS[column])
    op.execute(statement.bindparams(slug=slug, old_text=old_text, new_text=new_text))


def upgrade() -> None:
    """Describe the compulsory 50-60% photography split."""
    for slug, column, old_text, new_text in REPLACEMENTS:
        _replace(column, slug, old_text, new_text)


def downgrade() -> None:
    """Put back the 0008 wording."""
    for slug, column, old_text, new_text in reversed(REPLACEMENTS):
        _replace(column, slug, new_text, old_text)
