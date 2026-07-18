"""Shared helpers and imports for booking payment modules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.email.dispatch import dispatch_booking_notification
from app.features.payments import stripe as stripe_service
from app.features.realtime.sse import notify_user

logger = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _notify_pair(client_user_id: str, vendor_user_id: str) -> None:
    if get_settings().local_auth_mode:
        return
    if client_user_id:
        notify_user(client_user_id, "booking_changed")
    if vendor_user_id:
        notify_user(vendor_user_id, "booking_changed")


def _get_vendor_stripe_fields(vendor_user_id: str) -> dict[str, Any] | None:
    res = (
        get_client()
        .table("vendors")
        .select("stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled")
        .eq("user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def _load_full_booking_row(booking_id: str) -> dict[str, Any] | None:
    """Load the full booking row for payment work (list views omit vendor_amount_gbp)."""
    if not booking_id:
        return None
    res = (
        get_client()
        .table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]
