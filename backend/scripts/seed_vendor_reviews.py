#!/usr/bin/env python3
"""Seed landing-page reviews for the two latest approved vendors.

Usage (from backend/):
  PYTHONPATH=. poetry run python scripts/seed_vendor_reviews.py

Replaces any prior landing seed reviews (v1 demo prefix or v2 marker).
Creates named seed client accounts when missing (Amara, Chioma, Jordan).
"""

from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta, timezone

from app.core.db import get_db, one_row, rows
from app.core.logging import get_logger

logger = get_logger(__name__)

SEED_BOOKING_NOTES = "seed:landing-review-v2"
LEGACY_DEMO_PREFIX = "Eventtz demo review:"

SEED_CLIENTS: tuple[dict[str, str], ...] = (
    {"email": "amara@eventtz.co.uk", "label": "Amara"},
    {"email": "chioma@eventtz.co.uk", "label": "Chioma"},
    {"email": "jordan@eventtz.co.uk", "label": "Jordan"},
)

EVENT_TITLES = (
    "Traditional wedding reception",
    "Birthday celebration",
    "Naming ceremony",
)

# Per-vendor review sets (rating, body) — natural copy, no demo prefix.
VENDOR_REVIEW_SETS: tuple[tuple[tuple[int, str], ...], ...] = (
    (
        (
            5,
            "The food was incredible and our guests kept going back for more. Booking through "
            "Eventtz was straightforward and the vendor was responsive from the first message.",
        ),
        (
            5,
            "We used Eventtz for our daughter's birthday and everything ran on time. Clear quote, "
            "easy payment, and the team delivered exactly what we discussed.",
        ),
        (
            4,
            "Really happy with the catering overall. One small timing tweak on the day, but the "
            "vendor sorted it quickly and the celebration still felt seamless.",
        ),
    ),
    (
        (
            5,
            "Beautiful setup and everything we ordered arrived as described. Eventtz made it easy "
            "to compare options and confirm the booking in one place.",
        ),
        (
            5,
            "Professional service from enquiry to collection. The quote was clear and paying in the "
            "app gave us confidence the booking was locked in.",
        ),
        (
            4,
            "Great quality rentals and friendly communication. Would happily book again for our next "
            "family event.",
        ),
    ),
)


def _cleanup_legacy_seed(client) -> None:
    legacy_reviews = (
        client.table("booking_reviews")
        .select("id, booking_request_id, body")
        .like("body", f"{LEGACY_DEMO_PREFIX}%")
        .execute()
    )
    legacy_booking_ids = [
        str(r["booking_request_id"])
        for r in rows(legacy_reviews)
        if isinstance(r, dict) and r.get("booking_request_id")
    ]
    legacy_review_ids = [str(r["id"]) for r in rows(legacy_reviews) if isinstance(r, dict)]
    if legacy_review_ids:
        client.table("booking_reviews").delete().in_("id", legacy_review_ids).execute()
    if legacy_booking_ids:
        client.table("booking_requests").delete().in_("id", legacy_booking_ids).execute()

    marked_bookings = (
        client.table("booking_requests")
        .select("id")
        .eq("notes", SEED_BOOKING_NOTES)
        .execute()
    )
    marked_ids = [str(r["id"]) for r in rows(marked_bookings) if isinstance(r, dict)]
    if marked_ids:
        client.table("booking_reviews").delete().in_("booking_request_id", marked_ids).execute()
        client.table("booking_requests").delete().in_("id", marked_ids).execute()


def _ensure_seed_client(client, email: str) -> str:
    existing = (
        client.table("users")
        .select("id")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    row = one_row(existing)
    if row:
        return str(row["id"])

    password = secrets.token_urlsafe(24)
    created = client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"user_type": "client"},
        }
    )
    user = getattr(created, "user", None)
    if user is None or not getattr(user, "id", None):
        raise RuntimeError(f"Failed to create seed client {email}")

    user_id = str(user.id)
    client.table("users").upsert(
        {"id": user_id, "email": email, "user_type": "client"},
        on_conflict="id",
    ).execute()
    logger.info("Created seed client %s", email)
    return user_id


def _approved_vendors(client, limit: int = 2) -> list[dict]:
    res = (
        client.table("vendors")
        .select("user_id, payload, approval_status, updated_at")
        .eq("approval_status", "approved")
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [r for r in rows(res) if isinstance(r, dict)]


def _business_name(payload: dict | None) -> str:
    if not isinstance(payload, dict):
        return "Event vendor"
    name = payload.get("businessName")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return "Event vendor"


def seed() -> None:
    client = get_db()
    _cleanup_legacy_seed(client)

    client_ids = [_ensure_seed_client(client, c["email"]) for c in SEED_CLIENTS]
    vendors = _approved_vendors(client)
    if not vendors:
        raise SystemExit("No approved vendors found.")

    now = datetime.now(timezone.utc)
    created = 0

    for vendor_index, vendor in enumerate(vendors):
        vendor_id = str(vendor["user_id"])
        label = _business_name(vendor.get("payload"))
        review_set = VENDOR_REVIEW_SETS[vendor_index % len(VENDOR_REVIEW_SETS)]

        for idx, (rating, body) in enumerate(review_set):
            client_id = client_ids[idx % len(client_ids)]
            event_date = date.today() - timedelta(days=(idx + 1) * 45)
            paid_at = (now - timedelta(days=(idx + 1) * 45)).isoformat()
            completed_at = (now - timedelta(days=(idx + 1) * 44)).isoformat()
            review_at = (now - timedelta(days=(idx + 1) * 43)).isoformat()

            booking_res = (
                client.table("booking_requests")
                .insert(
                    {
                        "client_user_id": client_id,
                        "vendor_user_id": vendor_id,
                        "event_name": EVENT_TITLES[idx],
                        "event_date": event_date.isoformat(),
                        "event_postcode": "SW1A 1AA",
                        "event_address": "London, UK",
                        "notes": SEED_BOOKING_NOTES,
                        "status": "completed",
                        "payment_status": "payout_released",
                        "selected_option_ids": [],
                        "line_items": [],
                        "vendor_adjustments": [],
                        "total_label": "£850",
                        "paid_at": paid_at,
                        "client_completion_confirmed_at": completed_at,
                        "vendor_completion_confirmed_at": completed_at,
                    }
                )
                .execute()
            )
            booking = one_row(booking_res)
            if not booking:
                raise RuntimeError(f"Failed to create seed booking for {label}")

            client.table("booking_reviews").insert(
                {
                    "booking_request_id": booking["id"],
                    "vendor_user_id": vendor_id,
                    "client_user_id": client_id,
                    "rating": rating,
                    "body": body,
                    "created_at": review_at,
                }
            ).execute()
            created += 1
            logger.info("Seeded review %s/3 for %s.", idx + 1, label)

    print(f"Done. Created {created} review(s) with named seed clients (Amara, Chioma, Jordan).")


if __name__ == "__main__":
    seed()
