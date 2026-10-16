"""The database writes of account closure: erase what the person owns, then tombstone them.

Most of these tables belong to other slices, whose models a slice may not import, so
they are reached through `sqlalchemy.table()` handles naming only the columns used (the
same precedent as `staff/repository.py`). Every function mirrors a line range of
`backend/app/features/settings/account_deletion_erase.py` (or `_storage.py`). Nothing
here deletes a `users`, `booking_requests`, `conversations` or `vendors` row.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text, Uuid, column, delete, select, table, update
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid
from app.features.identity.domain_deletion import (
    CLOSED_VENDOR_LISTING_REASON,
    REDACTED_EMAIL,
    REDACTED_MESSAGE_BODY,
)
from app.features.identity.models import EmailVerificationToken, PasswordResetToken, User

# --- table handles for other slices' tables (see module docstring) ---------------------------------

_messages = table("messages", column("sender_user_id", Uuid), column("body", Text), column("metadata", JSONB))
_booking_notifications = table("booking_notifications", column("user_id", Uuid))
_contact_submissions = table("contact_submissions", column("user_id", Uuid))
_referral_attributions = table("referral_attributions", column("user_id", Uuid))
_client_saved_vendors = table(
    "client_saved_vendors", column("client_user_id", Uuid), column("vendor_user_id", Uuid)
)
_client_events = table("client_events", column("client_user_id", Uuid))
_celebration_plans = table("celebration_plans", column("client_user_id", Uuid))
_email_delivery_log = table(
    "email_delivery_log", column("recipient_user_id", Uuid), column("recipient_email", Text)
)
_marketplace_events = table("marketplace_events", column("actor_user_id", Uuid), column("payload", JSONB))
_booking_reviews = table("booking_reviews", column("client_user_id", Uuid), column("image_urls", ARRAY(Text)))
_vendors = table(
    "vendors",
    column("user_id", Uuid),
    column("payload", JSONB),
    column("stripe_account_id", Text),
    column("stripe_charges_enabled", Boolean),
    column("stripe_payouts_enabled", Boolean),
    column("listing_override", Text),
    column("listing_override_reason", Text),
    column("listing_override_by", Uuid),
    column("listing_override_at", DateTime(timezone=True)),
)


async def vendor_stripe_account_id(session: AsyncSession, user_id: str) -> str | None:
    """The account's Connect account id, read before the vendor row is wiped (`:185-202`)."""
    result = await session.execute(
        select(_vendors.c.stripe_account_id).where(_vendors.c.user_id == as_uuid(user_id)).limit(1)
    )
    account_id = str(result.scalar() or "").strip()
    return account_id or None


async def redact_sent_messages(session: AsyncSession, user_id: str) -> None:
    """Replace the body of every message the account sent and drop its metadata (`:94-109`)."""
    await session.execute(
        update(_messages)
        .where(_messages.c.sender_user_id == as_uuid(user_id))
        .values(body=REDACTED_MESSAGE_BODY, metadata={})
    )


async def delete_personal_rows(session: AsyncSession, user_id: str) -> None:
    """Delete notifications, one-click tokens, contact forms, referral and saved-vendor rows (`:70-76`)."""
    account_uuid = as_uuid(user_id)
    owned_rows = (
        delete(_booking_notifications).where(_booking_notifications.c.user_id == account_uuid),
        delete(PasswordResetToken).where(PasswordResetToken.user_id == account_uuid),
        delete(EmailVerificationToken).where(EmailVerificationToken.user_id == account_uuid),
        delete(_contact_submissions).where(_contact_submissions.c.user_id == account_uuid),
        delete(_referral_attributions).where(_referral_attributions.c.user_id == account_uuid),
        # Both sides: what a client saved, and every client's bookmark of a closing vendor.
        delete(_client_saved_vendors).where(_client_saved_vendors.c.client_user_id == account_uuid),
        delete(_client_saved_vendors).where(_client_saved_vendors.c.vendor_user_id == account_uuid),
    )
    for statement in owned_rows:
        await session.execute(statement)


async def delete_client_planner(session: AsyncSession, user_id: str) -> None:
    """Delete the client's planner events and celebration plans (`:112-121`).

    Bookings were unlinked from these events first (bookings' `erase_client_booking_extras`).
    """
    account_uuid = as_uuid(user_id)
    plans = _celebration_plans
    await session.execute(delete(_client_events).where(_client_events.c.client_user_id == account_uuid))
    await session.execute(delete(plans).where(plans.c.client_user_id == account_uuid))


async def redact_logs(session: AsyncSession, user_id: str) -> None:
    """Blank the account's address in the email log and its marketplace event payloads (`:124-140`)."""
    account_uuid = as_uuid(user_id)
    await session.execute(
        update(_email_delivery_log)
        .where(_email_delivery_log.c.recipient_user_id == account_uuid)
        .values(recipient_email=REDACTED_EMAIL)
    )
    await session.execute(
        update(_marketplace_events)
        .where(_marketplace_events.c.actor_user_id == account_uuid)
        .values(payload={})
    )


async def clear_review_images(session: AsyncSession, user_id: str) -> list[str]:
    """Empty the image lists of the client's reviews and return the URLs they held (`_storage.py:18-46`).

    The caller deletes the stored files after this; the reviews themselves stay.
    """
    account_uuid = as_uuid(user_id)
    result = await session.execute(
        select(_booking_reviews.c.image_urls).where(_booking_reviews.c.client_user_id == account_uuid)
    )
    image_urls = [str(url) for urls in result.scalars() for url in (urls or []) if url]
    await session.execute(
        update(_booking_reviews)
        .where(_booking_reviews.c.client_user_id == account_uuid)
        .values(image_urls=[])
    )
    return image_urls


async def tombstone_user(session: AsyncSession, user_id: str, *, now: datetime) -> None:
    """Mark the account closed and wipe its personal columns; the row itself stays (`:150-163`).

    A closed account is never restored: sign-up with the same email creates a new row.
    """
    await session.execute(
        update(User)
        .where(User.id == as_uuid(user_id))
        .values(
            deleted_at=now,
            email=None,
            preferred_name=None,
            contact_phone=None,
            share_email=False,
            share_phone=False,
            share_address=False,
            email_verified_at=None,
            account_suspended=False,
        )
    )


async def wipe_vendor_listing(session: AsyncSession, user_id: str, *, now: datetime) -> None:
    """Blank a closing vendor's profile, detach Stripe and hide the listing; the row stays (`:166-182`)."""
    await session.execute(
        update(_vendors)
        .where(_vendors.c.user_id == as_uuid(user_id))
        .values(
            payload={},
            stripe_account_id=None,
            stripe_charges_enabled=False,
            stripe_payouts_enabled=False,
            listing_override="hidden",
            listing_override_reason=CLOSED_VENDOR_LISTING_REASON,
            listing_override_by=None,
            listing_override_at=now,
        )
    )
