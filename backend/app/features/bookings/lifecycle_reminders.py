"""One-shot high-impact reminders: event tomorrow, pay-to-confirm, payouts setup."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.db import get_db
from app.core.logging import get_logger
from app.features.auth.accounts import deleted_user_ids
from app.features.bookings.completion_rules import event_day_over
from app.features.email.dispatch import (
    dispatch_booking_notification,
    send_vendor_setup_payouts_nudge_email,
)
from app.features.vendors.visibility import payout_gate_waived, vendor_payouts_verified

logger = get_logger(__name__)

_PAY_TO_CONFIRM_AFTER = timedelta(hours=24)
_PAYOUTS_NUDGE_AFTER = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _event_start_date(row: dict[str, Any]) -> datetime | None:
    date_str = str(row.get("event_date") or "")[:10]
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def event_date_is_tomorrow(row: dict[str, Any], now: datetime | None = None) -> bool:
    start = _event_start_date(row)
    if start is None:
        return False
    stamp = now if now is not None else _now()
    tomorrow = (stamp.astimezone(timezone.utc).date() + timedelta(days=1))
    return start.date() == tomorrow


def should_send_event_tomorrow(row: dict[str, Any], now: datetime | None = None) -> bool:
    if str(row.get("status") or "") != "accepted":
        return False
    if str(row.get("payment_status") or "") != "paid":
        return False
    if row.get("event_tomorrow_reminded_at"):
        return False
    if event_day_over(row, now):
        return False
    return event_date_is_tomorrow(row, now)


def should_send_pay_to_confirm(row: dict[str, Any], now: datetime | None = None) -> bool:
    if str(row.get("status") or "") != "accepted":
        return False
    if str(row.get("payment_status") or "") != "unpaid":
        return False
    if row.get("pay_to_confirm_reminded_at"):
        return False
    if event_day_over(row, now):
        return False
    accepted = _parse_ts(row.get("accepted_at"))
    if accepted is None:
        return False
    stamp = now if now is not None else _now()
    return stamp - accepted >= _PAY_TO_CONFIRM_AFTER


def should_send_payouts_setup(row: dict[str, Any], now: datetime | None = None) -> bool:
    if str(row.get("approval_status") or "") != "approved":
        return False
    if row.get("payouts_setup_nudge_at"):
        return False
    if vendor_payouts_verified(row) or payout_gate_waived(row):
        return False
    approved = _parse_ts(row.get("approved_at"))
    if approved is None:
        return False
    stamp = now if now is not None else _now()
    return stamp - approved >= _PAYOUTS_NUDGE_AFTER


def _stamp_booking(booking_id: str, column: str) -> None:
    try:
        get_db().table("booking_requests").update({column: _now_iso()}).eq(
            "id",
            booking_id,
        ).execute()
    except Exception:
        logger.exception("lifecycle_reminders: stamp %s failed booking=%s", column, booking_id)


def _stamp_vendor(user_id: str, column: str) -> None:
    try:
        get_db().table("vendors").update({column: _now_iso()}).eq("user_id", user_id).execute()
    except Exception:
        logger.exception("lifecycle_reminders: stamp %s failed vendor=%s", column, user_id)


def process_event_tomorrow_reminders(limit: int = 50) -> int:
    """One day-before reminder to both parties on paid accepted bookings."""
    try:
        res = (
            get_db()
            .table("booking_requests")
            .select(
                "id,status,payment_status,event_date,event_end_date,event_name,"
                "client_user_id,vendor_user_id,event_tomorrow_reminded_at",
            )
            .eq("status", "accepted")
            .eq("payment_status", "paid")
            .is_("event_tomorrow_reminded_at", "null")
            .limit(limit * 3)
            .execute()
        )
        rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("lifecycle_reminders: list event-tomorrow failed")
        return 0

    sent = 0
    now = _now()
    for row in rows:
        if sent >= limit:
            break
        if not should_send_event_tomorrow(row, now):
            continue
        booking_id = str(row.get("id") or "")
        event_name = str(row.get("event_name") or "") or None
        client_id = str(row.get("client_user_id") or "")
        vendor_id = str(row.get("vendor_user_id") or "")
        if not booking_id:
            continue
        gone = deleted_user_ids([client_id, vendor_id])
        try:
            if client_id and client_id not in gone:
                dispatch_booking_notification(
                    user_id=client_id,
                    booking_id=booking_id,
                    kind="event_tomorrow",
                    mode="insert_if_absent",
                    portal="client",
                    event_name=event_name,
                )
            if vendor_id and vendor_id not in gone:
                dispatch_booking_notification(
                    user_id=vendor_id,
                    booking_id=booking_id,
                    kind="vendor_event_tomorrow",
                    mode="insert_if_absent",
                    portal="vendor",
                    event_name=event_name,
                )
        except Exception:
            logger.exception(
                "lifecycle_reminders: event-tomorrow notify failed booking=%s",
                booking_id,
            )
            continue
        _stamp_booking(booking_id, "event_tomorrow_reminded_at")
        sent += 1
    return sent


def process_pay_to_confirm_reminders(limit: int = 50) -> int:
    """Remind the client once if they have not paid 24h after accept."""
    try:
        res = (
            get_db()
            .table("booking_requests")
            .select(
                "id,status,payment_status,event_date,event_end_date,event_name,"
                "client_user_id,accepted_at,pay_to_confirm_reminded_at",
            )
            .eq("status", "accepted")
            .eq("payment_status", "unpaid")
            .is_("pay_to_confirm_reminded_at", "null")
            .limit(limit * 3)
            .execute()
        )
        rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("lifecycle_reminders: list pay-to-confirm failed")
        return 0

    sent = 0
    now = _now()
    gone = deleted_user_ids(
        [str(r.get("client_user_id") or "") for r in rows if r.get("client_user_id")],
    )
    for row in rows:
        if sent >= limit:
            break
        if not should_send_pay_to_confirm(row, now):
            continue
        booking_id = str(row.get("id") or "")
        client_id = str(row.get("client_user_id") or "")
        if not booking_id or not client_id:
            continue
        if client_id in gone:
            _stamp_booking(booking_id, "pay_to_confirm_reminded_at")
            continue
        try:
            dispatch_booking_notification(
                user_id=client_id,
                booking_id=booking_id,
                kind="pay_to_confirm",
                mode="insert_if_absent",
                portal="client",
                event_name=str(row.get("event_name") or "") or None,
            )
        except Exception:
            logger.exception(
                "lifecycle_reminders: pay-to-confirm notify failed booking=%s",
                booking_id,
            )
            continue
        _stamp_booking(booking_id, "pay_to_confirm_reminded_at")
        sent += 1
    return sent


def process_payouts_setup_nudges(limit: int = 50) -> int:
    """One email 24h after approval if Stripe payouts are not ready."""
    try:
        res = (
            get_db()
            .table("vendors")
            .select(
                "user_id,approval_status,approved_at,payouts_setup_nudge_at,"
                "stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled,"
                "listing_override,payload",
            )
            .eq("approval_status", "approved")
            .is_("payouts_setup_nudge_at", "null")
            .limit(limit * 3)
            .execute()
        )
        rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("lifecycle_reminders: list payouts-setup failed")
        return 0

    sent = 0
    now = _now()
    gone = deleted_user_ids([str(r.get("user_id") or "") for r in rows if r.get("user_id")])
    for row in rows:
        if sent >= limit:
            break
        if not should_send_payouts_setup(row, now):
            continue
        user_id = str(row.get("user_id") or "")
        if not user_id:
            continue
        if user_id in gone:
            _stamp_vendor(user_id, "payouts_setup_nudge_at")
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        raw_name = payload.get("businessName") if payload else None
        business_name = raw_name.strip() if isinstance(raw_name, str) else None
        try:
            ok = send_vendor_setup_payouts_nudge_email(
                vendor_user_id=user_id,
                vendor_email=None,
                business_name=business_name,
            )
        except Exception:
            logger.exception("lifecycle_reminders: payouts-setup email failed vendor=%s", user_id)
            continue
        if not ok:
            continue
        _stamp_vendor(user_id, "payouts_setup_nudge_at")
        sent += 1
    return sent


def process_lifecycle_reminders() -> dict[str, int]:
    return {
        "event_tomorrow": process_event_tomorrow_reminders(),
        "pay_to_confirm": process_pay_to_confirm_reminders(),
        "payouts_setup": process_payouts_setup_nudges(),
    }
