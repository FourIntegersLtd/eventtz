"""Automatic payout release and completion reminder jobs."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.features.bookings.completion_rules import (
    compute_payout_auto_release_at,
    event_day_over,
)
from app.features.bookings.payment_completion import _finalize_completion
from app.features.bookings.payment_shared import (
    _notify_pair,
    _now_iso,
    get_client,
    logger,
)
from app.features.email.dispatch import dispatch_booking_notification

LIST_COMPLETION_TOUCH_CAP = 10


def _format_release_date(release_at: datetime) -> str:
    """Human-readable release date (portable across platforms)."""
    return release_at.strftime("%A %d %B").replace(" 0", " ")


def maybe_send_completion_reminder_for_row(row: dict[str, Any]) -> bool:
    """Send one post-event nudge per booking to whoever hasn't confirmed yet."""
    if row.get("completion_reminder_sent_at"):
        return False
    if not event_day_over(row):
        return False
    booking_id = str(row.get("id") or "")
    client_id = str(row.get("client_user_id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    release_at = compute_payout_auto_release_at(row)
    release_label = _format_release_date(release_at) if release_at else "soon"
    if client_id and not row.get("client_completion_confirmed_at"):
        dispatch_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="completion_reminder",
            body=(
                "We hope your event went well.\n\n"
                "If everything was as expected, please confirm the booking is complete. "
                f"If something went wrong, report a problem before {release_label}, "
                "otherwise we will pay the vendor automatically."
            ),
        )
    if vendor_id and not row.get("vendor_completion_confirmed_at"):
        dispatch_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind="vendor_completion_reminder",
            body=(
                "Your event date has passed.\n\n"
                "Please confirm the booking is complete to receive your payout sooner. "
                f"If the client does not respond, you will be paid automatically on {release_label} "
                "unless they have reported a problem."
            ),
        )
    get_client().table("booking_requests").update(
        {"completion_reminder_sent_at": _now_iso()},
    ).eq("id", booking_id).execute()
    _notify_pair(client_id, vendor_id)
    return True


def touch_booking_completion_side_effects(row: dict[str, Any]) -> bool:
    """For one booking (detail page or hourly job): send a reminder, then pay the vendor if due."""
    try:
        maybe_send_completion_reminder_for_row(row)
    except Exception:
        logger.exception("completion reminder failed booking=%s", row.get("id"))
    try:
        return _auto_release_payout_row(row)
    except ValueError:
        logger.warning("auto-release failed booking=%s", row.get("id"))
        return False
    except Exception:
        logger.exception("auto-release failed booking=%s", row.get("id"))
        return False


def touch_completion_side_effects_for_booking_rows(
    rows: list[dict[str, Any]],
    *,
    cap: int = LIST_COMPLETION_TOUCH_CAP,
) -> None:
    """Send completion reminders when a booking list is loaded — reminders only, no payout.

    Automatic payout runs on the booking detail page, the hourly job, and admin retry —
    not on list views, which refresh often from the dashboard.
    """
    if get_settings().local_auth_mode:
        return
    touched = 0
    for row in rows:
        if touched >= cap:
            break
        if str(row.get("status") or "") != "accepted":
            continue
        if str(row.get("payment_status") or "") != "paid":
            continue
        if not event_day_over(row):
            continue
        try:
            maybe_send_completion_reminder_for_row(row)
        except Exception:
            logger.exception("completion reminder failed booking=%s", row.get("id"))
        touched += 1


def _auto_release_payout_row(row: dict[str, Any]) -> bool:
    """Pay the vendor for one booking if the automatic payout date has passed.

    Why: if neither party confirms after the event, funds would otherwise sit
    held forever; this is the 48h safety net (skipped when a dispute or support hold exists).

    Returns True when the payout was sent. Raises ValueError when the Stripe
    transfer fails (from _finalize_completion).
    """
    # Import here to avoid a circular import at module load.
    from app.features.bookings.disputes import has_active_dispute_for_booking

    booking_id = str(row.get("id") or "")
    if row.get("payout_auto_released_at"):
        return False
    release_at = compute_payout_auto_release_at(row)
    if release_at is None or datetime.now(timezone.utc) < release_at:
        return False
    if has_active_dispute_for_booking(booking_id):
        return False
    if row.get("support_hold"):
        return False
    result = _finalize_completion(row)
    if str((result or {}).get("payment_status") or "") != "payout_released":
        # e.g. vendor Stripe account not ready — leave for a later run.
        return False
    get_client().table("booking_requests").update(
        {"payout_auto_released_at": _now_iso()},
    ).eq("id", booking_id).execute()
    logger.info("payout auto-released booking=%s", booking_id)
    return True


def maybe_auto_release_payout_for_booking(booking_id: str) -> bool:
    """Pay the vendor when opening booking detail if the automatic payout date has passed."""
    if get_settings().local_auth_mode:
        return False
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return False
    return touch_booking_completion_side_effects(rows[0])


def _due_completion_candidates(limit: int, *, extra_null_col: str) -> list[dict[str, Any]]:
    """Accepted + paid bookings whose event day has ended (incl. multi-day events)."""
    res = (
        get_client()
        .table("booking_requests")
        .select("*")
        .eq("status", "accepted")
        .eq("payment_status", "paid")
        .is_(extra_null_col, "null")
        .limit(limit * 3)
        .execute()
    )
    now = datetime.now(timezone.utc)
    eligible: list[dict[str, Any]] = []
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        if not event_day_over(row, now):
            continue
        eligible.append(row)
        if len(eligible) >= limit:
            break
    return eligible


def process_due_payout_auto_releases(limit: int = 50) -> int:
    """Hourly job: pay vendors whose automatic payout date has passed. Returns how many were paid."""
    if get_settings().local_auth_mode:
        return 0
    released = 0
    for row in _due_completion_candidates(limit, extra_null_col="payout_auto_released_at"):
        try:
            if _auto_release_payout_row(row):
                released += 1
        except Exception:
            logger.exception("auto-release failed booking=%s", row.get("id"))
    return released


def send_completion_reminders(limit: int = 50) -> int:
    """Hourly job: one post-event reminder per booking to whoever has not confirmed yet."""
    if get_settings().local_auth_mode:
        return 0
    sent = 0
    for row in _due_completion_candidates(limit, extra_null_col="completion_reminder_sent_at"):
        try:
            if maybe_send_completion_reminder_for_row(row):
                sent += 1
        except Exception:
            logger.exception("completion reminder failed booking=%s", row.get("id"))
    return sent
