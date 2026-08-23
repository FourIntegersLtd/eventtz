"""PII erasure and tombstone updates for account closure."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.db import get_db, rows_from_query_result
from app.core.logging import get_logger
from app.features.email.dispatch import dispatch_booking_notification
from app.features.settings import messages as settings_messages
from app.features.settings.account_deletion_gates import bookings_for_user
from app.features.settings.account_deletion_storage import delete_review_images, delete_user_storage

logger = get_logger(__name__)

_REDACTED_EMAIL = "redacted@invalid"


def cancel_unpaid_pending(user_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for row in bookings_for_user(user_id):
        if str(row.get("status") or "") != "pending":
            continue
        if str(row.get("payment_status") or "unpaid") not in ("unpaid", ""):
            continue
        booking_id = str(row.get("id") or "")
        if not booking_id:
            continue
        try:
            get_db().table("booking_requests").update(
                {
                    "status": "cancelled",
                    "cancelled_by": "client" if str(row.get("client_user_id")) == user_id else "vendor",
                    "cancelled_at": now,
                },
            ).eq("id", booking_id).eq("status", "pending").execute()
        except Exception:
            logger.exception("account_deletion: cancel pending failed booking=%s", booking_id)
            continue
        other = (
            str(row.get("vendor_user_id") or "")
            if str(row.get("client_user_id")) == user_id
            else str(row.get("client_user_id") or "")
        )
        kind = (
            "booking_cancelled_by_client"
            if str(row.get("client_user_id")) == user_id
            else "booking_cancelled_by_vendor"
        )
        if other and other != user_id:
            try:
                dispatch_booking_notification(
                    user_id=other,
                    booking_id=booking_id,
                    kind=kind,
                    body="The other person has closed their Eventtz account, so this enquiry is cancelled.",
                )
            except Exception:
                logger.exception(
                    "account_deletion: notify cancel failed booking=%s other=%s",
                    booking_id,
                    other,
                )


def erase_owned_data(user_id: str) -> None:
    redact_booking_extras(user_id)
    redact_messages(user_id)
    delete_eq("booking_notifications", "user_id", user_id)
    delete_eq("password_reset_tokens", "user_id", user_id)
    delete_eq("email_verification_tokens", "user_id", user_id)
    delete_eq("contact_submissions", "user_id", user_id)
    delete_eq("referral_attributions", "user_id", user_id)
    delete_eq("client_saved_vendors", "client_user_id", user_id)
    delete_eq("client_saved_vendors", "vendor_user_id", user_id)
    delete_client_planner(user_id)
    redact_email_log(user_id)
    redact_marketplace_events(user_id)
    delete_review_images(user_id)
    delete_user_storage(user_id)


def redact_booking_extras(user_id: str) -> None:
    """Clear client-owned extras only. Venue, date, and amounts stay for the other party."""
    try:
        get_db().table("booking_requests").update(
            {"notes": None, "client_search_context": None},
        ).eq("client_user_id", user_id).execute()
    except Exception:
        logger.exception("account_deletion: redact booking extras failed user=%s", user_id)


def redact_messages(user_id: str) -> None:
    try:
        get_db().table("messages").update(
            {"body": settings_messages.REDACTED_MESSAGE_BODY, "metadata": {}},
        ).eq("sender_user_id", user_id).execute()
        return
    except Exception as e:
        if "metadata" not in str(e).lower():
            logger.exception("account_deletion: redact messages failed user=%s", user_id)
            return
    try:
        get_db().table("messages").update(
            {"body": settings_messages.REDACTED_MESSAGE_BODY},
        ).eq("sender_user_id", user_id).execute()
    except Exception:
        logger.exception("account_deletion: redact message bodies failed user=%s", user_id)


def delete_client_planner(user_id: str) -> None:
    try:
        get_db().table("booking_requests").update({"event_id": None}).eq(
            "client_user_id",
            user_id,
        ).execute()
    except Exception:
        logger.exception("account_deletion: unlink client events failed user=%s", user_id)
    delete_eq("client_events", "client_user_id", user_id)
    delete_eq("celebration_plans", "client_user_id", user_id)


def redact_email_log(user_id: str) -> None:
    try:
        get_db().table("email_delivery_log").update(
            {"recipient_email": _REDACTED_EMAIL},
        ).eq("recipient_user_id", user_id).execute()
    except Exception:
        logger.exception("account_deletion: redact email log failed user=%s", user_id)


def redact_marketplace_events(user_id: str) -> None:
    try:
        get_db().table("marketplace_events").update({"payload": {}}).eq(
            "actor_user_id",
            user_id,
        ).execute()
    except Exception:
        logger.exception("account_deletion: redact marketplace events failed user=%s", user_id)


def delete_eq(table: str, column: str, user_id: str) -> None:
    try:
        get_db().table(table).delete().eq(column, user_id).execute()
    except Exception:
        logger.warning("account_deletion: delete %s.%s failed user=%s", table, column, user_id)


def tombstone_user(user_id: str) -> None:
    get_db().table("users").update(
        {
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "email": None,
            "preferred_name": None,
            "contact_phone": None,
            "share_email": False,
            "share_phone": False,
            "share_address": False,
            "email_verified_at": None,
            "account_suspended": False,
        },
    ).eq("id", user_id).execute()


def wipe_vendor_if_any(user_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    try:
        get_db().table("vendors").update(
            {
                "payload": {},
                "stripe_account_id": None,
                "stripe_charges_enabled": False,
                "stripe_payouts_enabled": False,
                "listing_override": "hidden",
                "listing_override_reason": "Account deleted",
                "listing_override_by": None,
                "listing_override_at": now,
            },
        ).eq("user_id", user_id).execute()
    except Exception:
        logger.exception("account_deletion: wipe vendor failed user=%s", user_id)


def vendor_stripe_account_id(user_id: str) -> str | None:
    try:
        res = (
            get_db()
            .table("vendors")
            .select("stripe_account_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = rows_from_query_result(res)
        if not rows:
            return None
        acct = str(rows[0].get("stripe_account_id") or "").strip()
        return acct or None
    except Exception:
        logger.warning("account_deletion: load stripe account failed user=%s", user_id)
        return None
