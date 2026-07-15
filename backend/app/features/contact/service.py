"""Save contact form submissions and notify admins."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.contracts.contact import CONTACT_SUBJECT_LABELS
from app.features.auth.accounts import fetch_user_profile
from app.features.email.dispatch import send_admin_contact_submitted_email

logger = get_logger(__name__)

_BOOKING_SUBJECTS = frozenset({"booking_problem", "payments"})


def submit_contact_message(
    *,
    user_id: str,
    portal: str,
    subject: str,
    message: str,
    booking_id: str | None = None,
) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        raise ValueError("Contact form isn't available in this environment.")

    body = message.strip()
    if len(body) < 10:
        raise ValueError("Please enter at least 10 characters.")

    subj = subject.strip().lower()
    if subj not in CONTACT_SUBJECT_LABELS:
        raise ValueError("Please choose a valid topic.")

    resolved_booking_id: str | None = None
    if booking_id and booking_id.strip():
        try:
            uuid.UUID(booking_id.strip())
        except ValueError as e:
            raise ValueError("That booking reference doesn't look right.") from e
        resolved_booking_id = booking_id.strip()
        row = (
            get_client()
            .table("booking_requests")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", resolved_booking_id)
            .limit(1)
            .execute()
        )
        data = getattr(row, "data", None) or []
        if not data or not isinstance(data[0], dict):
            raise ValueError("Booking not found.")
        br = data[0]
        cid = str(br.get("client_user_id") or "")
        vid = str(br.get("vendor_user_id") or "")
        if portal == "client" and cid != user_id:
            raise ValueError("That booking is not on your account.")
        if portal == "vendor" and vid != user_id:
            raise ValueError("That booking is not on your account.")
    elif subj in _BOOKING_SUBJECTS:
        raise ValueError("Please include your booking reference for this topic.")

    label = CONTACT_SUBJECT_LABELS[subj]
    insert_res = (
        get_client()
        .table("contact_submissions")
        .insert(
            {
                "user_id": user_id,
                "portal": portal,
                "subject": label,
                "message": body,
                "booking_id": resolved_booking_id,
            },
        )
        .execute()
    )
    if not getattr(insert_res, "data", None):
        logger.warning("contact_submissions insert returned no data user=%s", user_id)

    prof = fetch_user_profile(user_id) or {}
    user_email = str(prof.get("email") or "")
    send_admin_contact_submitted_email(
        portal=portal,
        user_email=user_email or None,
        subject=label,
        message=body,
        booking_id=resolved_booking_id,
    )
    return {"success": True}
