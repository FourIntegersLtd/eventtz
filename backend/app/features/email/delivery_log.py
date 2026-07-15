"""Record sent emails so booking notifications are not sent twice on retry."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.email.constants import EMAIL_DEDUPE_KINDS

logger = get_logger(__name__)

ADMIN_PAYOUT_STUCK_TEMPLATE = "admin.payout_stuck"


def booking_template_id(kind: str) -> str:
    return f"booking.{kind}"


def should_dedupe_booking_kind(kind: str) -> bool:
    return kind in EMAIL_DEDUPE_KINDS


def claim_email_delivery(
    *,
    template_id: str,
    recipient_email: str,
    recipient_user_id: str,
    booking_id: str,
) -> bool:
    """Log a send attempt; return False if this email was already logged for this booking."""
    if get_settings().local_auth_mode:
        return False
    try:
        get_client().table("email_delivery_log").insert(
            {
                "template_id": template_id,
                "recipient_email": recipient_email.strip().lower(),
                "recipient_user_id": recipient_user_id,
                "booking_id": booking_id,
            },
        ).execute()
        return True
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "23505" in err or "unique" in err:
            logger.info(
                "email dedupe skip template=%s booking=%s user=%s",
                template_id,
                booking_id,
                recipient_user_id,
            )
            return False
        logger.exception(
            "email_delivery_log insert failed template=%s booking=%s",
            template_id,
            booking_id,
        )
        return True


def claim_booking_email_send(
    *,
    kind: str,
    recipient_email: str,
    recipient_user_id: str,
    booking_id: str,
) -> bool:
    """Return True if we should send; False if we already sent this booking email to this person."""
    if get_settings().local_auth_mode:
        return False
    if not should_dedupe_booking_kind(kind):
        return True
    return claim_email_delivery(
        template_id=booking_template_id(kind),
        recipient_email=recipient_email,
        recipient_user_id=recipient_user_id,
        booking_id=booking_id,
    )


def claim_admin_payout_stuck_email(*, booking_id: str, vendor_user_id: str) -> bool:
    """At most one ops alert per booking (vendor_user_id is part of the unique log key)."""
    if not vendor_user_id:
        return True
    return claim_email_delivery(
        template_id=ADMIN_PAYOUT_STUCK_TEMPLATE,
        recipient_email="ops@eventtz.internal",
        recipient_user_id=vendor_user_id,
        booking_id=booking_id,
    )
