"""Needs-attention flags for the admin console: what is wrong with a booking, and what to do about it.

Ported from the baseline's `admin/booking_diagnostics.py`. A booking earns zero or
more flags (each with a severity), and the admin screen shows the most urgent one
plus a suggested next action. This module is pure given its inputs (the booking
row, whether the vendor's Stripe payouts are enabled, and whether a dispute is
open); the batched lookups that produce those inputs live in `repository_admin.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from app.features.bookings import domain
from app.features.bookings.rows import BookingRow

Severity = Literal["critical", "warning"]

# Suggested next-action labels, verbatim from the baseline.
ACTION_CHECK_PAYMENT = "Check payment"
ACTION_UNBLOCK_CHECKOUT = "Unblock checkout"
ACTION_PAY_VENDOR = "Pay vendor"
ACTION_FINISH_CANCELLATION = "Finish cancellation"
ACTION_MARK_COMPLETE_CLIENT = "Mark complete (client)"
ACTION_MARK_COMPLETE_VENDOR = "Mark complete (vendor)"
ACTION_RESUME_PAYOUT = "Resume payout"


def _flag(code: str, *, severity: Severity, label: str) -> dict[str, Any]:
    """One needs-attention flag, in the shape the admin screen reads."""
    return {"code": code, "severity": severity, "label": label}


def build_needs_attention_flags(
    booking: BookingRow,
    *,
    now: datetime,
    hours_after_event: float,
    vendor_payouts_enabled: bool,
    has_active_dispute: bool,
) -> list[dict[str, Any]]:
    """Every diagnostic flag this booking earns right now."""
    flags: list[dict[str, Any]] = []

    if booking.stripe_payment_intent_id and booking.payment_status in ("unpaid", "pending"):
        flags.append(
            _flag(
                "payment_not_marked_paid",
                severity="critical",
                label="Stripe payment intent on file but booking is not marked paid",
            )
        )
    if booking.payment_status == "pending" and booking.stripe_checkout_session_id:
        flags.append(
            _flag(
                "checkout_pending",
                severity="warning",
                label="Checkout session pending - may be stale or awaiting sync",
            )
        )
    if booking.payment_status == "refunded" and booking.status == "accepted":
        flags.append(
            _flag(
                "refund_status_mismatch",
                severity="critical",
                label="Payment refunded but booking status is still accepted",
            )
        )

    if booking.payment_status != "paid" or booking.status != "accepted":
        return flags

    has_transfer = bool(booking.stripe_transfer_id)
    if has_active_dispute:
        flags.append(
            _flag(
                "dispute_blocks_payout",
                severity="warning",
                label="Open dispute blocks payout and cancellation",
            )
        )
    if booking.support_hold:
        flags.append(
            _flag(
                "support_hold",
                severity="warning",
                label="Support hold is on - automatic payout release is paused",
            )
        )

    client_confirmed = bool(booking.client_completion_confirmed_at)
    vendor_confirmed = bool(booking.vendor_completion_confirmed_at)
    if client_confirmed and vendor_confirmed and not has_transfer:
        flags.append(
            _flag(
                "payout_not_released",
                severity="critical",
                label="Both parties confirmed but payout was not released",
            )
        )

    release_at = domain.payout_auto_release_at(booking, hours_after_event=hours_after_event)
    if domain.event_day_over(booking, now):
        waiting_on = domain.completion_waiting_on(booking)
        if waiting_on and not has_transfer:
            flags.append(
                _flag(
                    "event_over_awaiting_completion",
                    severity="warning",
                    label=f"Event is over - waiting for {waiting_on} to confirm completion",
                )
            )
        if (
            release_at is not None
            and now >= release_at
            and not booking.payout_auto_released_at
            and not has_transfer
            and not booking.support_hold
            and not has_active_dispute
        ):
            flags.append(
                _flag(
                    "auto_release_overdue",
                    severity="warning",
                    label="Auto-release window has passed but payout not released",
                )
            )

    needs_payout = (client_confirmed and vendor_confirmed) or (
        domain.event_day_over(booking, now) and release_at is not None and now >= release_at
    )
    if needs_payout and not vendor_payouts_enabled and not has_transfer:
        flags.append(
            _flag(
                "vendor_payouts_disabled", severity="critical", label="Vendor Stripe payouts are not enabled"
            )
        )

    return flags


def suggest_next_action(booking: BookingRow, flags: list[dict[str, Any]]) -> str | None:
    """What staff should do first, given this booking's flags (priority order, baseline verbatim)."""
    codes = {flag["code"] for flag in flags}
    if "payment_not_marked_paid" in codes:
        return ACTION_CHECK_PAYMENT
    if "refund_status_mismatch" in codes:
        return ACTION_FINISH_CANCELLATION
    if "checkout_pending" in codes:
        return ACTION_UNBLOCK_CHECKOUT
    if "dispute_blocks_payout" in codes:
        return None
    if "support_hold" in codes:
        return ACTION_RESUME_PAYOUT
    if (
        "payout_not_released" in codes or "auto_release_overdue" in codes
    ) and "vendor_payouts_disabled" not in codes:
        return ACTION_PAY_VENDOR
    if "event_over_awaiting_completion" in codes:
        waiting_on = domain.completion_waiting_on(booking)
        if waiting_on == "vendor":
            return ACTION_MARK_COMPLETE_VENDOR
        return ACTION_MARK_COMPLETE_CLIENT
    return None


def summarize_support(booking: BookingRow, flags: list[dict[str, Any]]) -> dict[str, Any]:
    """The admin screen's support summary for one booking: worst flag, count, and what to do."""
    if not flags:
        return {"needs_attention_count": 0, "max_severity": None, "primary_label": None, "next_action": None}
    ordered = sorted(flags, key=lambda flag: (0 if flag["severity"] == "critical" else 1, flag["label"]))
    max_severity: Severity = (
        "critical" if any(flag["severity"] == "critical" for flag in flags) else "warning"
    )
    return {
        "needs_attention_count": len(flags),
        "max_severity": max_severity,
        "primary_label": ordered[0]["label"],
        "next_action": suggest_next_action(booking, flags),
    }


def support_meta_for_booking(
    booking: BookingRow,
    *,
    now: datetime | None = None,
    hours_after_event: float,
    vendor_payouts_enabled: bool,
    has_active_dispute: bool,
    open_dispute: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The admin detail screen's full support block for one booking (includes `support_hold`)."""
    flags = build_needs_attention_flags(
        booking,
        now=now or datetime.now(UTC),
        hours_after_event=hours_after_event,
        vendor_payouts_enabled=vendor_payouts_enabled,
        has_active_dispute=has_active_dispute,
    )
    return {
        "needs_attention": flags,
        "open_dispute": open_dispute,
        "support_hold": bool(booking.support_hold),
        "vendor_stripe_payouts_enabled": vendor_payouts_enabled,
        "next_action": suggest_next_action(booking, flags),
    }
