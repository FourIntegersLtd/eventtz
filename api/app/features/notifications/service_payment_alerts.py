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
