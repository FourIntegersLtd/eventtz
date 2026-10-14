"""Pure contact-form rules: subjects and their labels, message and booking-reference checks, prompts.

The classifier prompt is pinned to the baseline by `tests/golden/content/contact_classifier.json`.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.ports import ChatMessage
from app.features.content.domain_blog import is_uuid
from app.features.content.errors import InvalidBookingReference, MessageTooShort

ContactSubject = Literal[
    "general",
    "booking_problem",
    "payments",
    "account",
    "other",
    "feedback_bug",
    "feedback_feature",
    "feedback_general",
    "feedback_other",
]

# The label stored in `contact_submissions.subject` and shown to staff, per subject key.
SUBJECT_LABELS: dict[str, str] = {
    "general": "General",
    "booking_problem": "Booking problem",
    "payments": "Payments",
    "account": "Account",
    "other": "Other",
    "feedback_bug": "Bug report",
    "feedback_feature": "Feature idea",
    "feedback_general": "General feedback",
    "feedback_other": "Other feedback",
}

# The admin console's "Report a bug" form always files under this subject (no classifier).
ADMIN_BUG_REPORT_SUBJECT: ContactSubject = "feedback_bug"
# Used whenever the classifier is off or fails.
FALLBACK_SUBJECT: ContactSubject = "other"
# Subjects that also go to the Cursor automation webhook for triage.
AUTOMATION_SUBJECTS = frozenset({"feedback_bug", "booking_problem", "payments"})

MINIMUM_MESSAGE_LENGTH = 10
# The classifier reads at most this much of a message.
CLASSIFIED_MESSAGE_LENGTH = 4000
CLASSIFIER_MODEL = "gpt-6-luna"

CLASSIFIER_SYSTEM_PROMPT = (
    "You classify Eventtz support messages into exactly one subject key. "
    "Eventtz is a UK marketplace for African and diaspora event vendors. "
    "Pick the best matching key. Prefer a specific key over general or other. "
    "Use feedback_bug for product defects, errors, or something broken. "
    "Use feedback_feature for feature requests. "
    "Use booking_problem for issues with a specific booking or enquiry. "
    "Use payments for payouts, charges, refunds, or invoices. "
    "Use account for login, profile, or approval access. "
    f"Allowed subject keys: {', '.join(SUBJECT_LABELS)}."
)


class ContactClassification(BaseModel):
    """The structured answer the classifier model must return."""

    subject: ContactSubject
    rationale: str = Field(default="", max_length=200)


def clean_message(message: str) -> str:
    """The message without surrounding spaces; `MessageTooShort` if under 10 characters then."""
    body = message.strip()
    if len(body) < MINIMUM_MESSAGE_LENGTH:
        raise MessageTooShort()
    return body


def booking_reference(raw_reference: str | None) -> str | None:
    """The trimmed booking id, `None` when blank, `InvalidBookingReference` when not a UUID."""
    if not raw_reference or not raw_reference.strip():
        return None
    reference = raw_reference.strip()
    if not is_uuid(reference):
        raise InvalidBookingReference()
    return reference


def classifier_messages(*, portal: str, message: str) -> list[ChatMessage]:
    """The prompt asking the model to pick one subject key for a message."""
    user_prompt = (
        f"Portal: {portal}\n\nClassify this support message.\n\n{message.strip()[:CLASSIFIED_MESSAGE_LENGTH]}"
    )
    return [
        {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]


def automation_payload(
    *,
    submission_id: str | None,
    portal: str,
    user_id: str,
    user_email: str | None,
    subject: str,
    message: str,
    booking_id: str | None,
) -> dict[str, Any]:
    """The JSON the Cursor automation webhook receives for a triage-worthy message."""
    return {
        "source": "eventtz_contact",
        "submission_id": submission_id,
        "portal": portal,
        "user_id": user_id,
        "user_email": user_email,
        "subject": subject,
        "subject_label": SUBJECT_LABELS[subject],
        "message": message,
        "booking_id": booking_id,
    }
