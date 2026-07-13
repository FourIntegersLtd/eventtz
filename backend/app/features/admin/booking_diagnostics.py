"""Admin booking support diagnostics: needs-attention flags and dispute links."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.features.bookings.completion_rules import (
    completion_waiting_on,
    compute_payout_auto_release_at,
    event_day_over,
)
from app.features.bookings.disputes import has_active_dispute_for_booking
from app.features.bookings.payments import _get_vendor_stripe_fields
from app.core.config import get_settings
from app.core.db import get_db as get_client

# Labels must match support action titles in AdminBookingDetailView.
ACTION_CHECK_PAYMENT = "Check payment"
ACTION_UNBLOCK_CHECKOUT = "Unblock checkout"
ACTION_PAY_VENDOR = "Pay vendor"
ACTION_FINISH_CANCELLATION = "Finish cancellation"
ACTION_MARK_COMPLETE_CLIENT = "Mark complete (client)"
ACTION_MARK_COMPLETE_VENDOR = "Mark complete (vendor)"
ACTION_RESUME_PAYOUT = "Resume payout"


def _open_dispute_for_booking(booking_id: str) -> dict[str, Any] | None:
    res = (
        get_client()
        .table("dispute_cases")
        .select("id,status,summary,created_at")
        .eq("booking_request_id", booking_id)
        .in_("status", ["open", "under_review"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    row = rows[0]
    return {
        "id": str(row.get("id") or ""),
        "status": str(row.get("status") or ""),
        "summary": str(row.get("summary") or ""),
        "created_at": row.get("created_at"),
    }


def _suggest_next_action(row: dict[str, Any], flags: list[dict[str, str]]) -> str | None:
    """One suggested support action — must match titles exposed in admin booking UI."""
    codes = {f["code"] for f in flags}

    if "payment_not_marked_paid" in codes:
        return ACTION_CHECK_PAYMENT
    if "refund_status_mismatch" in codes:
        return ACTION_FINISH_CANCELLATION
    if "checkout_pending" in codes:
        return ACTION_UNBLOCK_CHECKOUT
    # Resolve via dispute link, not a support action button.
    if "dispute_blocks_payout" in codes:
        return None
    if "support_hold" in codes:
        return ACTION_RESUME_PAYOUT
    if (
        "payout_not_released" in codes or "auto_release_overdue" in codes
    ) and "vendor_payouts_disabled" not in codes:
        return ACTION_PAY_VENDOR
    if "event_over_awaiting_completion" in codes:
        waiting = completion_waiting_on(row)
        if waiting == "client":
            return ACTION_MARK_COMPLETE_CLIENT
        if waiting == "vendor":
            return ACTION_MARK_COMPLETE_VENDOR
        if waiting == "both":
            return ACTION_MARK_COMPLETE_CLIENT
    # No support action fixes vendor Stripe setup — flag label carries the message.
    if "vendor_payouts_disabled" in codes:
        return None
    return None


def _build_needs_attention_flags(
    row: dict[str, Any],
    *,
    payouts_enabled: bool,
    has_active_dispute: bool,
) -> list[dict[str, str]]:
    """Flag rows that may need a support action (shared by detail + list summaries)."""
    booking_id = str(row.get("id") or "")
    status = str(row.get("status") or "")
    payment_status = str(row.get("payment_status") or "unpaid")
    flags: list[dict[str, str]] = []

    pi = row.get("stripe_payment_intent_id")
    if pi and payment_status in ("unpaid", "pending"):
        flags.append(
            {
                "code": "payment_not_marked_paid",
                "severity": "critical",
                "label": "Stripe payment intent on file but booking is not marked paid",
            },
        )

    if payment_status == "pending" and row.get("stripe_checkout_session_id"):
        flags.append(
            {
                "code": "checkout_pending",
                "severity": "warning",
                "label": "Checkout session pending — may be stale or awaiting sync",
            },
        )

    if payment_status == "refunded" and status == "accepted":
        flags.append(
            {
                "code": "refund_status_mismatch",
                "severity": "critical",
                "label": "Payment refunded but booking status is still accepted",
            },
        )

    if payment_status == "paid" and status == "accepted":
        if has_active_dispute:
            flags.append(
                {
                    "code": "dispute_blocks_payout",
                    "severity": "warning",
                    "label": "Open dispute blocks payout and cancellation",
                },
            )

        if row.get("support_hold"):
            flags.append(
                {
                    "code": "support_hold",
                    "severity": "warning",
                    "label": "Support hold is on — automatic payout release is paused",
                },
            )

        client_conf = bool(row.get("client_completion_confirmed_at"))
        vendor_conf = bool(row.get("vendor_completion_confirmed_at"))
        has_transfer = bool(row.get("stripe_transfer_id"))

        if client_conf and vendor_conf and not has_transfer:
            flags.append(
                {
                    "code": "payout_not_released",
                    "severity": "critical",
                    "label": "Both parties confirmed but payout was not released",
                },
            )

        if event_day_over(row):
            waiting = completion_waiting_on(row)
            if waiting and not has_transfer:
                flags.append(
                    {
                        "code": "event_over_awaiting_completion",
                        "severity": "warning",
                        "label": f"Event is over — waiting for {waiting} to confirm completion",
                    },
                )

            release_at = compute_payout_auto_release_at(row)
            now = datetime.now(timezone.utc)
            if (
                release_at
                and now >= release_at
                and not row.get("payout_auto_released_at")
                and not has_transfer
                and not row.get("support_hold")
                and not has_active_dispute
            ):
                flags.append(
                    {
                        "code": "auto_release_overdue",
                        "severity": "warning",
                        "label": "Auto-release window has passed but payout not released",
                    },
                )

        needs_payout = (client_conf and vendor_conf) or (
            event_day_over(row)
            and compute_payout_auto_release_at(row)
            and datetime.now(timezone.utc) >= compute_payout_auto_release_at(row)  # type: ignore[operator]
        )
        if needs_payout and not payouts_enabled and not has_transfer:
            flags.append(
                {
                    "code": "vendor_payouts_disabled",
                    "severity": "critical",
                    "label": "Vendor Stripe payouts are not enabled",
                },
            )

    return flags


def _summarize_support_flags(row: dict[str, Any], flags: list[dict[str, str]]) -> dict[str, Any]:
    if not flags:
        return {
            "needs_attention_count": 0,
            "max_severity": None,
            "primary_label": None,
            "next_action": None,
        }
    ordered = sorted(
        flags,
        key=lambda f: (0 if f["severity"] == "critical" else 1, f["label"]),
    )
    max_severity = "critical" if any(f["severity"] == "critical" for f in flags) else "warning"
    return {
        "needs_attention_count": len(flags),
        "max_severity": max_severity,
        "primary_label": ordered[0]["label"],
        "next_action": _suggest_next_action(row, flags),
    }


def _vendor_payouts_enabled_by_user_id(vendor_user_ids: list[str]) -> dict[str, bool]:
    if not vendor_user_ids:
        return {}
    try:
        res = (
            get_client()
            .table("vendors")
            .select("user_id,stripe_payouts_enabled")
            .in_("user_id", vendor_user_ids)
            .execute()
        )
    except Exception:
        return {}
    out: dict[str, bool] = {}
    for row in getattr(res, "data", None) or []:
        if isinstance(row, dict) and row.get("user_id"):
            out[str(row["user_id"])] = bool(row.get("stripe_payouts_enabled"))
    return out


def _booking_ids_with_active_disputes(booking_ids: list[str]) -> set[str]:
    if not booking_ids:
        return set()
    try:
        res = (
            get_client()
            .table("dispute_cases")
            .select("booking_request_id")
            .in_("booking_request_id", booking_ids)
            .in_("status", ["open", "under_review"])
            .execute()
        )
    except Exception:
        return set()
    out: set[str] = set()
    for row in getattr(res, "data", None) or []:
        if isinstance(row, dict) and row.get("booking_request_id"):
            out.add(str(row["booking_request_id"]))
    return out


def summarize_support_for_booking_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Lightweight support summary per booking id for admin list views."""
    if not rows:
        return {}
    vendor_ids = list(
        {str(r.get("vendor_user_id") or "") for r in rows if r.get("vendor_user_id")},
    )
    booking_ids = [str(r.get("id") or "") for r in rows if r.get("id")]
    payouts_by_vendor = _vendor_payouts_enabled_by_user_id(vendor_ids)
    disputed_ids = _booking_ids_with_active_disputes(booking_ids)

    summaries: dict[str, dict[str, Any]] = {}
    for row in rows:
        booking_id = str(row.get("id") or "")
        if not booking_id:
            continue
        vendor_id = str(row.get("vendor_user_id") or "")
        payouts_enabled = payouts_by_vendor.get(vendor_id, False)
        flags = _build_needs_attention_flags(
            row,
            payouts_enabled=payouts_enabled,
            has_active_dispute=booking_id in disputed_ids,
        )
        summaries[booking_id] = _summarize_support_flags(row, flags)
    return summaries


_SUPPORT_SCAN_SELECT = (
    "id,status,event_name,event_date,event_end_date,client_user_id,vendor_user_id,created_at,updated_at,"
    "paid_at,payment_status,stripe_payment_intent_id,stripe_checkout_session_id,stripe_transfer_id,"
    "support_hold,client_completion_confirmed_at,vendor_completion_confirmed_at,payout_auto_released_at"
)


def count_bookings_needing_support_attention(*, scan_limit: int = 300) -> int:
    """Count recent bookings with support flags (for dashboard attention)."""
    if get_settings().local_auth_mode:
        return 0
    scan_limit = max(1, min(scan_limit, 500))
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(_SUPPORT_SCAN_SELECT)
            .order("updated_at", desc=True)
            .limit(scan_limit)
            .execute()
        )
    except Exception:
        return 0
    rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    summaries = summarize_support_for_booking_rows(rows)
    return sum(1 for s in summaries.values() if s.get("needs_attention_count", 0) > 0)


def compute_admin_booking_support_meta(row: dict[str, Any]) -> dict[str, Any]:
    """Derive support diagnostics for admin booking detail."""
    booking_id = str(row.get("id") or "")
    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) if vendor_id else None
    payouts_enabled = bool(vendor_stripe and vendor_stripe.get("stripe_payouts_enabled"))
    flags = _build_needs_attention_flags(
        row,
        payouts_enabled=payouts_enabled,
        has_active_dispute=has_active_dispute_for_booking(booking_id),
    )
    next_action = _suggest_next_action(row, flags)

    return {
        "needs_attention": flags,
        "open_dispute": _open_dispute_for_booking(booking_id),
        "support_hold": bool(row.get("support_hold")),
        "vendor_stripe_payouts_enabled": payouts_enabled,
        "next_action": next_action,
    }
