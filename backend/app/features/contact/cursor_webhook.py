"""Fire-and-forget Cursor Automation webhook for bug-related contact submissions."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx

from app.contracts.contact import CURSOR_AUTOMATION_SUBJECTS
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# One worker: contact volume is low; avoids a thread per submission and lost work on shutdown.
_webhook_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cursor-webhook")


def should_notify_cursor_automation(subject_key: str) -> bool:
    return subject_key.strip().lower() in CURSOR_AUTOMATION_SUBJECTS


def _post_cursor_webhook(*, url: str, secret: str, payload: dict[str, Any]) -> None:
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(url, json=payload, headers=headers)
        if res.status_code >= 400:
            logger.warning(
                "Cursor automation webhook HTTP %s submission_id=%s subject=%s: %s",
                res.status_code,
                payload.get("submission_id"),
                payload.get("subject"),
                res.text[:500],
            )
            return
        logger.info(
            "Cursor automation webhook accepted HTTP %s submission_id=%s subject=%s",
            res.status_code,
            payload.get("submission_id"),
            payload.get("subject"),
        )
    except Exception:
        logger.exception(
            "Cursor automation webhook POST failed submission_id=%s",
            payload.get("submission_id"),
        )


def notify_cursor_automation_for_contact(
    *,
    submission_id: str | None,
    portal: str,
    user_id: str,
    subject_key: str,
    subject_label: str,
    message: str,
    booking_id: str | None,
    user_email: str | None,
) -> None:
    """POST structured contact context to Cursor; no-op when URL unset. Never raises."""
    try:
        settings = get_settings()
        url = settings.cursor_automation_webhook_url.strip()
        if not url:
            logger.info(
                "Cursor automation webhook skipped (URL unset) subject=%s submission_id=%s",
                subject_key,
                submission_id,
            )
            return

        payload: dict[str, Any] = {
            "source": "eventtz_contact",
            "submission_id": submission_id,
            "portal": portal,
            "user_id": user_id,
            "user_email": user_email,
            "subject": subject_key,
            "subject_label": subject_label,
            "message": message,
            "booking_id": booking_id,
        }
        secret = settings.cursor_automation_webhook_secret.strip()
        logger.info(
            "Cursor automation webhook dispatching subject=%s portal=%s submission_id=%s",
            subject_key,
            portal,
            submission_id,
        )
        _webhook_executor.submit(
            _post_cursor_webhook,
            url=url,
            secret=secret,
            payload=payload,
        )
    except Exception:
        logger.exception(
            "Cursor automation webhook dispatch failed submission_id=%s",
            submission_id,
        )
