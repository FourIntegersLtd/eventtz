"""Seed local client/vendor logins and paid bookings with frozen receipts (compose only).

Creates or refreshes:
- client@example.com (client) and vendor@example.com (vendor, approved listing)
- Booking A: accepted, paid (`pi_local_seed_a`), frozen client + vendor payment records
- Booking B: completed, payout_released (`stripe_transfer_id`), frozen payout statement
- Booking C: accepted, unpaid (for receipt 404 browser checks)

Password for both accounts: ``LocalAdmin123!``. Refuses non-local ``DATABASE_URL``.
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urlparse

from app.core.db import dispose_engine, job_session
from app.core.ports import OutgoingEmail
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.bookings import service_receipts
from app.features.identity import repository as identity_repository
from app.features.identity.domain_accounts import normalise_email
from app.features.identity.service_staff_accounts import set_account_password
from app.features.identity.tokens import hash_password
from app.features.vendors import repository as vendors_repository

LOCAL_HOSTS = frozenset({"127.0.0.1", "localhost"})
PASSWORD = "LocalAdmin123!"  # noqa: S105 — local compose seed only

CLIENT_EMAIL = "client@example.com"
VENDOR_EMAIL = "vendor@example.com"

BOOKING_PAID_ID = "a0000000-0000-4000-8000-000000000001"
BOOKING_PAYOUT_ID = "a0000000-0000-4000-8000-000000000002"
BOOKING_UNPAID_ID = "a0000000-0000-4000-8000-000000000003"

PACKAGE = {"id": "pkg-1", "title": "Classic Package", "price": "150", "pricingMode": "fixed"}
LINE_ITEM = {"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 150.0}


@dataclass
class _NoopMailer:
    """Discards receipt emails during local seeding."""

    def send(self, email: OutgoingEmail) -> bool:
        """Pretend every receipt email was accepted."""
        return True


def _database_host(database_url: str) -> str | None:
    """Hostname from a SQLAlchemy/psycopg URL."""
    url = database_url
    if url.startswith("postgresql+psycopg://"):
        url = "postgresql://" + url[len("postgresql+psycopg://") :]
    return urlparse(url).hostname


def _require_local_database() -> None:
    """Refuse to run unless ``DATABASE_URL`` points at local compose Postgres."""
    host = _database_host(get_settings().database_url)
    if host not in LOCAL_HOSTS:
        sys.stderr.write(
            "seed_local_receipts only runs against a local compose database (127.0.0.1 or localhost).\n"
        )
        raise SystemExit(1)


async def _upsert_portal_account(session, email: str, user_type: str) -> str:
    """Create or refresh a client/vendor login; never restore a closed account."""
    normalised = normalise_email(email)
    now = datetime.now(UTC)
    profile = await identity_repository.find_profile_by_email(session, normalised)
    if profile is None:
        user_id = await identity_repository.create_account(
            session,
            email=normalised,
            user_type=user_type,
            password_hash=hash_password(PASSWORD),
            admin_role=None,
            email_verified_at=now,
        )
        if user_id is None:
            raise RuntimeError(f"Could not create {email}: address already taken.")
        return user_id
    if profile.deleted_at:
        sys.stderr.write(f"{email} is a closed account; remove it from the local DB first\n")
        raise SystemExit(1)
    await identity_repository.update_profile(
        session,
        profile.id,
        {"user_type": user_type, "email_verified_at": now, "account_suspended": False},
    )
    await set_account_password(session, profile.id, PASSWORD)
    return profile.id


async def _ensure_vendor_listing(session, vendor_id: str) -> None:
    """Approved vendor profile with one fixed-price package for pricing breakdown."""
    saved = await vendors_repository.save_profile(
        session,
        vendor_id,
        {
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "local receipt seed",
            "payload": {
                "businessName": "Local Seed Vendor",
                "maxBookingsPerDay": "20",
                "packages": [PACKAGE],
            },
        },
        exists=await vendors_repository.get_vendor(session, vendor_id) is not None,
    )
    if not saved:
        raise RuntimeError("Could not save vendor profile for receipt seed.")


async def _upsert_booking(session, booking_id: str, values: dict) -> None:
    """Insert a booking with a fixed id, or update it when the seed is re-run."""
    existing = await bookings_repository.get_booking(session, booking_id)
    if existing is None:
        await bookings_repository.insert_booking(session, {"id": booking_id, **values})
        return
    await bookings_repository.update_booking(session, booking_id, values)


async def _seed_bookings(session, client_id: str, vendor_id: str) -> None:
    """Three bookings: paid, payout-released, and unpaid."""
    shared = {
        "client_user_id": client_id,
        "vendor_user_id": vendor_id,
        "initiator": "client",
        "event_date": "2099-06-15",
        "event_address": "10 Seed Street, London",
        "selected_option_ids": ["pkg-1"],
        "line_items": [LINE_ITEM],
        "vendor_adjustments": [],
        "total_label": "GBP 157.50",
        "payment_amount_gbp": 157.5,
        "vendor_amount_gbp": 150.0,
        "platform_fee_gbp": 7.5,
    }
    await _upsert_booking(
        session,
        BOOKING_PAID_ID,
        {
            **shared,
            "event_name": "Local receipt seed A",
            "status": "accepted",
            "payment_status": "paid",
            "paid_at": "2030-01-15T12:00:00+00:00",
            "stripe_payment_intent_id": "pi_local_seed_a",
            "stripe_charge_id": "ch_local_seed_a",
        },
    )
    await _upsert_booking(
        session,
        BOOKING_PAYOUT_ID,
        {
            **shared,
            "event_name": "Local receipt seed B",
            "status": "completed",
            "payment_status": "payout_released",
            "paid_at": "2030-01-10T12:00:00+00:00",
            "payout_released_at": "2030-02-01T09:00:00+00:00",
            "stripe_payment_intent_id": "pi_local_seed_b",
            "stripe_charge_id": "ch_local_seed_b",
            "stripe_transfer_id": "tr_local_seed_b",
        },
    )
    await _upsert_booking(
        session,
        BOOKING_UNPAID_ID,
        {
            **shared,
            "event_name": "Local receipt seed unpaid",
            "status": "accepted",
            "payment_status": "unpaid",
            "total_label": "GBP 150",
            "payment_amount_gbp": None,
            "vendor_amount_gbp": None,
            "platform_fee_gbp": None,
            "paid_at": None,
            "stripe_payment_intent_id": None,
            "stripe_charge_id": None,
        },
    )


async def _freeze_receipts(session) -> None:
    """Write frozen snapshots so receipt routes skip live Stripe verification."""
    mailer = _NoopMailer()
    await service_receipts.freeze_after_checkout(session, mailer, BOOKING_PAID_ID)
    await service_receipts.freeze_after_checkout(session, mailer, BOOKING_PAYOUT_ID)
    await service_receipts.freeze_after_payout(session, mailer, BOOKING_PAYOUT_ID)


async def _main() -> None:
    """Seed accounts, bookings and frozen receipts when run as a module."""
    _require_local_database()
    async with job_session() as session:
        client_id = await _upsert_portal_account(session, CLIENT_EMAIL, "client")
        vendor_id = await _upsert_portal_account(session, VENDOR_EMAIL, "vendor")
        await _ensure_vendor_listing(session, vendor_id)
        await _seed_bookings(session, client_id, vendor_id)
        await _freeze_receipts(session)
    await dispose_engine()
    sys.stdout.write(
        f"{CLIENT_EMAIL}\n{VENDOR_EMAIL}\n{BOOKING_PAID_ID}\n{BOOKING_PAYOUT_ID}\n{BOOKING_UNPAID_ID}\n"
    )


if __name__ == "__main__":
    asyncio.run(_main())
