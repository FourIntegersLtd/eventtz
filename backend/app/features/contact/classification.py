"""Classify contact form messages into a support subject via OpenAI parse."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.contracts.contact import CONTACT_SUBJECT_LABELS, ContactSubject
from app.core.constants import OPENAI_CONTACT_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, try_openai_client

logger = get_logger(__name__)

_FALLBACK_SUBJECT: ContactSubject = "other"

_SUBJECT_KEYS = ", ".join(CONTACT_SUBJECT_LABELS)

_SYSTEM = (
    "You classify Eventtz support messages into exactly one subject key. "
    "Eventtz is a UK marketplace for African and diaspora event vendors. "
    "Pick the best matching key. Prefer a specific key over general or other. "
    "Use feedback_bug for product defects, errors, or something broken. "
    "Use feedback_feature for feature requests. "
    "Use booking_problem for issues with a specific booking or enquiry. "
    "Use payments for payouts, charges, refunds, or invoices. "
    "Use account for login, profile, or approval access. "
    f"Allowed subject keys: {_SUBJECT_KEYS}."
)


class ContactClassification(BaseModel):
    subject: ContactSubject
    rationale: str = Field(default="", max_length=200)


def classify_contact_message(*, portal: str, message: str) -> ContactSubject:
    """Return a subject key. Falls back to other if OpenAI is missing or fails."""
    client = try_openai_client()
    if client is None:
        logger.warning("contact_classify: OpenAI not configured - using %s", _FALLBACK_SUBJECT)
        return _FALLBACK_SUBJECT

    user = (
        f"Portal: {portal}\n\n"
        "Classify this support message.\n\n"
        f"{message.strip()[:4000]}"
    )
    try:
        parsed = parse_completion(
            client=client,
            model=OPENAI_CONTACT_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user},
            ],
            response_format=ContactClassification,
            log_context="contact_classify",
        )
        subject = parsed.subject
        if subject not in CONTACT_SUBJECT_LABELS:
            logger.warning("contact_classify: unexpected subject %r - using %s", subject, _FALLBACK_SUBJECT)
            return _FALLBACK_SUBJECT
        logger.info(
            "contact_classify: portal=%s subject=%s rationale=%r",
            portal,
            subject,
            (parsed.rationale or "")[:120],
        )
        return subject
    except Exception as e:
        logger.warning("contact_classify: parse failed portal=%s err=%s - using %s", portal, e, _FALLBACK_SUBJECT)
        return _FALLBACK_SUBJECT
