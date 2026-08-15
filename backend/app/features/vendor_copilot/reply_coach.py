"""AI draft replies for vendor booking enquiries."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.constants import OPENAI_COPILOT_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, require_openai_client
from app.features.bookings.queries import get_booking_request_for_vendor
from app.features.vendors.profile import get_vendor_profile

logger = get_logger(__name__)


class DraftReplyResult(BaseModel):
    draft_message: str
    tips: list[str] = Field(default_factory=list, max_length=3)


def _business_name(payload: dict[str, Any]) -> str:
    return str(payload.get("businessName") or "our team").strip()


def draft_enquiry_reply(
    *,
    vendor_user_id: str,
    booking_request_id: str,
    intent: Literal["accept", "decline", "clarify"] = "accept",
) -> dict[str, Any]:
    booking = get_booking_request_for_vendor(vendor_user_id, booking_request_id)
    if not booking:
        return {"draft_message": "", "tips": ["Booking not found."]}

    profile = get_vendor_profile(vendor_user_id)
    payload = profile.get("payload") if profile and isinstance(profile.get("payload"), dict) else {}
    biz = _business_name(payload)

    intent_guide = {
        "accept": "Write a warm message accepting the enquiry at the listed price. Confirm you are available and invite them to proceed to payment.",
        "decline": "Write a polite decline. Be brief, thank them, and optionally suggest they try another date if appropriate.",
        "clarify": "Write a friendly message asking 1-2 clarifying questions before accepting (guest count, timing, dietary needs, etc.).",
    }[intent]

    system = (
        "You draft short client messages for Eventtz vendors responding to booking enquiries.\n"
        "UK English, warm and professional. 2-4 sentences for the message body.\n"
        "Do not invent prices — use booking facts only.\n"
        "Do not include email signatures or placeholders like [Your name].\n"
        "tips: up to 2 brief reminders for the vendor (e.g. reply within 2 hours)."
    )

    booking_facts = {
        "business_name": biz,
        "event_name": booking.get("event_name"),
        "event_date": booking.get("event_date"),
        "event_address": booking.get("event_address"),
        "notes": (booking.get("notes") or "")[:800],
        "total_label": booking.get("total_label") or booking.get("initial_client_total_label"),
        "status": booking.get("status"),
        "intent": intent,
    }

    messages = [
        {"role": "system", "content": system},
        {"role": "system", "content": f"Task: {intent_guide}"},
        {"role": "user", "content": f"Booking facts:\n{booking_facts}\n\nDraft the message."},
    ]

    client = require_openai_client(log_context="vendor_copilot_reply")
    parsed = parse_completion(
        client=client,
        model=OPENAI_COPILOT_MODEL,
        messages=messages,
        response_format=DraftReplyResult,
        log_context="vendor_copilot_reply",
    )
    return {
        "draft_message": parsed.draft_message.strip(),
        "tips": parsed.tips[:3],
    }
