"""Draft a reply to a client enquiry, in the vendor's voice.

A booking id the vendor does not own — whether it does not exist at all, or belongs to
another vendor — is treated identically: `vendor_booking_detail` raises `BookingNotFound`
for both, and this returns the same fixed placeholder rather than a 404, matching the
baseline's `get_booking_request_for_vendor` quirk (it scopes by `vendor_user_id`, so an
unknown id and someone else's booking look the same to it).
"""

from __future__ import annotations

import asyncio

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import ChatMessage, LanguageModel
from app.features.bookings.errors import BookingNotFound
from app.features.bookings.service_queries import vendor_booking_detail
from app.features.copilot.schemas import CopilotDraftReplyResponse
from app.features.copilot.service_brief import COPILOT_MODEL
from app.features.vendors.service_profile import get_profile_state

# A booking this vendor does not own, or that does not exist at all.
_BOOKING_NOT_FOUND_TIP = "Booking not found."

_INTENT_GUIDE = {
    "accept": (
        "Write a warm message accepting the enquiry at the listed price. Confirm you are "
        "available and invite them to proceed to payment."
    ),
    "decline": "Write a polite decline. Be brief, thank them, and optionally suggest another date.",
    "clarify": (
        "Write a friendly message asking 1-2 clarifying questions before accepting (guest count, "
        "timing, dietary needs, etc.)."
    ),
}


class _DraftReplyReply(BaseModel):
    """The model's structured reply for a drafted enquiry response."""

    draft_message: str = ""
    tips: list[str] = Field(default_factory=list, max_length=3)


async def draft_enquiry_reply(
    session: AsyncSession,
    principal: Principal,
    *,
    booking_request_id: str,
    intent: str,
    language_model: LanguageModel,
) -> CopilotDraftReplyResponse:
    """A drafted reply for one of the vendor's enquiries, or the not-found placeholder."""
    try:
        booking = await vendor_booking_detail(session, principal.id, booking_request_id)
    except BookingNotFound:
        return CopilotDraftReplyResponse(draft_message="", tips=[_BOOKING_NOT_FOUND_TIP])

    profile = await get_profile_state(session, principal)
    business_name = str(profile.profile_form_data.get("businessName") or "our team").strip()

    total_label = (
        (booking.pricing.client_total_label if booking.pricing else None)
        or booking.total_label
        or booking.initial_client_total_label
    )
    booking_facts = {
        "business_name": business_name,
        "event_name": booking.event_name,
        "event_date": booking.event_date,
        "event_address": booking.event_address,
        "notes": (booking.notes or "")[:800],
        "total_label": total_label,
        "status": booking.booking_status,
        "intent": intent,
    }

    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "You draft short client messages for Eventtz vendors responding to booking enquiries.\n"
                "UK English, warm and professional. 2-4 sentences for the message body.\n"
                "Do not invent prices; use booking facts only. Never use em dashes.\n"
                "Do not include email signatures or placeholders like [Your name].\n"
                "tips: up to 2 brief reminders for the vendor."
            ),
        },
        {"role": "system", "content": f"Task: {_INTENT_GUIDE[intent]}"},
        {"role": "user", "content": f"Booking facts:\n{booking_facts}\n\nDraft the message."},
    ]
    reply = await asyncio.to_thread(
        language_model.parse,
        model=COPILOT_MODEL,
        messages=messages,
        reply_model=_DraftReplyReply,
        purpose="vendor_copilot_reply",
    )
    return CopilotDraftReplyResponse(draft_message=reply.draft_message.strip(), tips=reply.tips[:3])
