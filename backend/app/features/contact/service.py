"""Save contact form submissions and notify admins."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.db import get_db
from app.core.logging import get_logger
from app.contracts.contact import CONTACT_SUBJECT_LABELS
from app.features.auth.accounts import fetch_user_profile
from app.features.contact import messages as contact_messages
from app.features.contact.classification import classify_contact_message
from app.features.contact.cursor_webhook import (
    notify_cursor_automation_for_contact,
    should_notify_cursor_automation,
)
from app.features.email.dispatch import send_admin_contact_submitted_email

logger = get_logger(__name__)


def submit_contact_message(
    *,
    user_id: str,
    portal: str,
    message: str,
    booking_id: str | None = None,
    subject: str | None = None,
) -> dict[str, Any]:
    body = message.strip()
    if len(body) < 10:
        raise ValueError(contact_messages.MESSAGE_TOO_SHORT)

    if subject is not None:
        subj = subject.strip().lower()
        if subj not in CONTACT_SUBJECT_LABELS:
            raise ValueError(contact_messages.INVALID_TOPIC)
    else:
        subj = classify_contact_message(portal=portal, message=body)

    resolved_booking_id: str | None = None
    if booking_id and booking_id.strip():
        try:
            uuid.UUID(booking_id.strip())
        except ValueError as e:
            raise ValueError(contact_messages.INVALID_BOOKING_REFERENCE) from e
        resolved_booking_id = booking_id.strip()
        row = (
            get_db()
            .table("booking_requests")
            .select("id,client_user_id,vendor_user_id")
            .eq("id", resolved_booking_id)
            .limit(1)
            .execute()
        )
        data = getattr(row, "data", None) or []
        if not data or not isinstance(data[0], dict):
            raise ValueError(contact_messages.BOOKING_NOT_FOUND)
        br = data[0]
        cid = str(br.get("client_user_id") or "")
        vid = str(br.get("vendor_user_id") or "")
        if portal == "client" and cid != user_id:
            raise ValueError(contact_messages.BOOKING_NOT_ON_ACCOUNT)
        if portal == "vendor" and vid != user_id:
            raise ValueError(contact_messages.BOOKING_NOT_ON_ACCOUNT)

    label = CONTACT_SUBJECT_LABELS[subj]
    insert_res = (
        get_db()
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
    insert_data = getattr(insert_res, "data", None) or []
    submission_id: str | None = None
    if insert_data and isinstance(insert_data[0], dict):
        submission_id = str(insert_data[0].get("id") or "") or None
    else:
        logger.warning("contact_submissions insert returned no data user=%s", user_id)

    prof = fetch_user_profile(user_id) or {}
    user_email = str(prof.get("email") or "")
    if should_notify_cursor_automation(subj):
        notify_cursor_automation_for_contact(
            submission_id=submission_id,
            portal=portal,
            user_id=user_id,
            subject_key=subj,
            subject_label=label,
            message=body,
            booking_id=resolved_booking_id,
            user_email=user_email or None,
        )
    send_admin_contact_submitted_email(
        portal=portal,
        user_email=user_email or None,
        subject=label,
        message=body,
        booking_id=resolved_booking_id,
    )
    return {"success": True}
