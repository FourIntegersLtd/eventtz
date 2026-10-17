"""Ops alerts and notice copy the payment flows need: a refund or payout that Stripe refused.

Bookings and payments call these when money could not move, so staff hear about
it by email even though the client or vendor only sees a friendly error.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.notifications import repository
from app.features.notifications.domain import AdminAlert, admin_sign_in_url
from app.features.notifications.domain_booking_copy import (
    PAYMENT_RECEIVED_CLIENT_BODY,
    VENDOR_PAYMENT_RECEIVED_BODY,
)
from app.features.notifications.service import send_admin_alert

log = get_logger(__name__)

__all__ = [
    "PAYMENT_RECEIVED_CLIENT_BODY",
    "VENDOR_PAYMENT_RECEIVED_BODY",
    "send_chargeback_alert",
    "send_checkout_refunded_alert",
    "send_deposit_claim_alert",
    "send_external_refund_alert",
    "send_payout_stuck_alert",
    "send_refund_failed_alert",
]

# The payout-stuck alert is logged against this pseudo-recipient so it goes out once per booking.
_OPS_RECIPIENT = "ops@eventtz.internal"
_PAYOUT_STUCK_TEMPLATE = "admin.payout_stuck"


def send_refund_failed_alert(mailer: Mailer, *, booking_id: str, error_hint: str | None) -> bool:
    """Tell staff a Stripe refund failed for `booking_id`. False when the email could not go out."""
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id="admin.refund_failed",
            subject=f"[Eventtz ops] Refund failed | booking {booking_id[:8]}",
            headline="Stripe refund failed",
            fields=[("Booking", booking_id)],
            body=error_hint or "Check logs and Stripe dashboard.",
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )


def send_checkout_refunded_alert(mailer: Mailer, *, booking_id: str, reason: str, detail: str) -> bool:
    """Tell staff a Checkout payment was refunded because the booking could not take it.

    Money moved outside the normal flow (a stale tab, a cancelled booking, a charged amount
    that differs from the priced total), so staff check the booking even though the client
    has already been refunded. False when the email could not go out.
    """
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id="admin.checkout_refunded",
            subject=f"[Eventtz ops] Checkout payment refunded | booking {booking_id[:8]}",
            headline="A Checkout payment was refunded automatically",
            fields=[("Booking", booking_id), ("Reason", reason)],
            body=detail,
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )


def send_deposit_claim_alert(
    mailer: Mailer, *, booking_id: str, claim_label: str, deposit_label: str, note: str
) -> bool:
    """Tell staff a vendor claimed part of a client's damage deposit, so they decide it.

    The deposit stays held until staff resolve the claim from the admin booking page.
    False when the email could not go out.
    """
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id="admin.deposit_claim",
            subject=f"[Eventtz ops] Deposit claim to decide | booking {booking_id[:8]}",
            headline="A vendor claimed part of a damage deposit",
            fields=[("Booking", booking_id), ("Claimed", claim_label), ("Deposit", deposit_label)],
            body=note,
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )


def send_chargeback_alert(
    mailer: Mailer,
    *,
    booking_id: str,
    dispute_id: str,
    amount_label: str,
    reason: str | None,
    outcome: str,
) -> bool:
    """Tell staff a card chargeback was opened, won or lost on `booking_id` (`outcome` is one of those).

    An open chargeback puts the booking on support hold, so nothing pays out or refunds
    until staff clear it; a lost one has already taken the money back from Eventtz's
    balance, so the booking reads refunded. False when the email could not go out.
    """
    headline = {
        "opened": "Card chargeback opened: booking put on hold",
        "won": "Card chargeback won: hold lifted",
        "lost": "Card chargeback lost: booking marked refunded",
    }.get(outcome, f"Card chargeback {outcome}")
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id="admin.chargeback",
            subject=f"[Eventtz ops] Chargeback {outcome} | booking {booking_id[:8]}",
            headline=headline,
            fields=[
                ("Booking", booking_id),
                ("Stripe dispute", dispute_id),
                ("Amount", amount_label),
                ("Reason", reason or "not given"),
            ],
            body=(
                "Respond to the dispute in the Stripe dashboard. "
                "The booking stays on hold until you clear it."
            ),
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )


def send_external_refund_alert(
    mailer: Mailer, *, booking_id: str, refunded_label: str, charged_label: str, payment_status: str
) -> bool:
    """Tell staff a refund made outside the app (the Stripe dashboard) was recorded on `booking_id`.

    The booking's `payment_status` now reflects it, but the booking status, the client's
    notice and any vendor share are for staff to settle. False when the email could not go out.
    """
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id="admin.external_refund",
            subject=f"[Eventtz ops] Refund outside the app | booking {booking_id[:8]}",
            headline="A refund was made in the Stripe dashboard",
            fields=[
                ("Booking", booking_id),
                ("Refunded so far", refunded_label),
                ("Charged", charged_label),
                ("Payment status now", payment_status),
            ],
            body="Check the booking: its status, the client's notice and any vendor share were not changed.",
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )


async def send_payout_stuck_alert(
    session: AsyncSession,
    mailer: Mailer,
    *,
    booking_id: str,
    vendor_user_id: str,
    error_hint: str | None,
) -> bool:
    """Tell staff a vendor payout Transfer failed, at most once per booking (retries stay quiet)."""
    claimed = await repository.claim_email_delivery(
        session,
        template_id=_PAYOUT_STUCK_TEMPLATE,
        recipient_email=_OPS_RECIPIENT,
        recipient_user_id=vendor_user_id,
        booking_id=booking_id,
    )
    if not claimed:
        log.info("payout stuck alert already sent booking=%s", booking_id)
        return False
    return send_admin_alert(
        mailer,
        AdminAlert(
            template_id=_PAYOUT_STUCK_TEMPLATE,
            subject=f"[Eventtz ops] Payout transfer failed | booking {booking_id[:8]}",
            headline="Vendor payout transfer failed",
            fields=[("Booking", booking_id), ("Vendor ID", vendor_user_id)],
            body=error_hint or "Stripe transfer failed. Vendor may need Connect verification.",
            action_url=admin_sign_in_url(),
            action_label="Sign in to admin",
        ),
    )
