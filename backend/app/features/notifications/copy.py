"""Plain-English titles and bodies for in-app booking notifications."""

from __future__ import annotations

from typing import Literal

Portal = Literal["client", "vendor"]

# Kinds whose stored body is booking-specific (pricing, quotes, refunds, deadlines) —
# keep it in the feed and emails when present.
_USE_STORED_BODY: frozenset[str] = frozenset(
    {
        "booking_accepted",
        "booking_declined_by_vendor",
        "booking_pricing_updated",
        "vendor_quote_received",
        "vendor_quote_accepted",
        "vendor_quote_declined",
        "vendor_quote_withdrawn",
        "client_confirmed_updated_price",
        "client_declined_updated_price",
        "booking_cancelled_by_client",
        "booking_cancelled_by_vendor",
        "payment_received",
        "vendor_payment_received",
        "payment_refunded",
        "completion_confirmed_awaiting_other_party",
        "completion_reminder",
        "vendor_completion_reminder",
    }
)

# When the dashboard already shows live booking rows, skip these notification kinds.
DASHBOARD_DUPLICATE_KINDS: dict[Portal, frozenset[str]] = {
    "vendor": frozenset({"booking_request_received"}),
    "client": frozenset({"vendor_quote_received"}),
}

# Client/vendor facing: short, polite, warm. Prefer two short paragraphs.
# Admin-facing copy lives in EmailService admin alerts and stays concise.
_COPY: dict[str, dict[Portal, tuple[str, str]]] = {
    "booking_request_received": {
        "vendor": (
            "New booking request",
            "A client has sent you a new booking request on Eventtz.\n\n"
            "Please take a moment to review the date, service and any notes they shared, "
            "then accept or decline when you can. They will hear from us as soon as you respond.",
        ),
        "client": (
            "Booking sent",
            "Your booking request is with the vendor.\n\n"
            "They will review the details and get back to you shortly. "
            "You can follow everything from your bookings page, and message them if you need to add anything.",
        ),
    },
    "booking_accepted": {
        "client": (
            "Booking accepted",
            "Good news: the vendor has accepted your booking.\n\n"
            "When you are ready, open the booking to check the final total and complete payment. "
            "Your place is confirmed once payment goes through.",
        ),
        "vendor": (
            "Booking accepted",
            "This booking is now accepted on your side.\n\n"
            "We will let you know as soon as the client pays. In the meantime you can message them "
            "on Eventtz if you need to finalise any details.",
        ),
    },
    "booking_declined_by_vendor": {
        "client": (
            "Booking declined",
            "Unfortunately the vendor is unable to take this booking.\n\n"
            "We are sorry that could not work out. You are welcome to browse other vendors on Eventtz "
            "and send a new request whenever you are ready.",
        ),
        "vendor": (
            "Booking declined",
            "You declined this booking request.\n\n"
            "The client has been notified. No further action is needed on your side.",
        ),
    },
    "booking_cancelled_by_client": {
        "vendor": (
            "Booking cancelled",
            "The client has cancelled this booking.\n\n"
            "The request is now closed. If you still need to tidy anything up, you can message them on Eventtz.",
        ),
        "client": (
            "Booking cancelled",
            "You cancelled this booking.\n\n"
            "The vendor has been notified. If you had already paid, any refund will be handled separately "
            "and usually reaches your card within a few working days.",
        ),
    },
    "booking_cancelled_by_vendor": {
        "client": (
            "Booking cancelled",
            "The vendor has cancelled this booking.\n\n"
            "We are sorry this did not go ahead. You can explore other vendors on Eventtz whenever you are ready, "
            "and we are here if you need help finding a replacement.",
        ),
        "vendor": (
            "Booking cancelled",
            "You cancelled this booking.\n\n"
            "The client has been notified. Thank you for letting them know in good time.",
        ),
    },
    "booking_completed": {
        "client": (
            "Booking complete",
            "This booking is now marked as complete.\n\n"
            "Thank you for using Eventtz. We hope your event went smoothly, and we would love to help again next time.",
        ),
        "vendor": (
            "Booking complete",
            "This booking has been marked as complete.\n\n"
            "Thank you for delivering through Eventtz. We appreciate the care you put into every booking.",
        ),
    },
    "booking_pricing_updated": {
        "client": (
            "Updated price",
            "Your vendor has sent an updated price for this booking.\n\n"
            "Please take a look at the new total when you can, then accept or decline. "
            "Nothing changes until you confirm.",
        ),
        "vendor": (
            "Updated price sent",
            "Your updated price is with the client.\n\n"
            "We will notify you as soon as they accept or decline. You can still message them "
            "if they need a quick explanation of what changed.",
        ),
    },
    "client_confirmed_updated_price": {
        "vendor": (
            "Price confirmed",
            "The client accepted your updated price.\n\n"
            "Payment is now due on their side. We will let you know the moment it is received.",
        ),
        "client": (
            "Price confirmed",
            "You accepted the updated price.\n\n"
            "When you are ready, you can pay from your bookings page. "
            "Your funds are held safely until the event is complete.",
        ),
    },
    "client_declined_updated_price": {
        "vendor": (
            "Booking declined",
            "The client declined the updated price.\n\n"
            "This booking has been closed. No further action is needed, though you are welcome "
            "to stay in touch on Eventtz if another date comes up.",
        ),
        "client": (
            "Booking declined",
            "You declined the updated price, so this booking is now closed.\n\n"
            "You can send a new request or browse other vendors whenever you like.",
        ),
    },
    "vendor_quote_received": {
        "client": (
            "New quote",
            "A vendor has sent you a quote on Eventtz.\n\n"
            "Open the booking to review what is included and the total, then accept or decline when you are ready. "
            "Feel free to message them if anything needs clarifying first.",
        ),
        "vendor": (
            "Quote sent",
            "Your quote is with the client.\n\n"
            "We will notify you when they respond. You can keep chatting on Eventtz in the meantime.",
        ),
    },
    "vendor_quote_accepted": {
        "vendor": (
            "Quote accepted",
            "Great news: the client accepted your quote.\n\n"
            "Payment will follow once they are ready. We will email you as soon as it lands.",
        ),
        "client": (
            "Quote accepted",
            "You accepted this quote.\n\n"
            "When you are ready, you can pay from your bookings page. "
            "We hold your payment safely until the event is complete.",
        ),
    },
    "vendor_quote_declined": {
        "vendor": (
            "Quote declined",
            "The client declined your quote.\n\n"
            "The booking has been closed. You can still message them on Eventtz if useful.",
        ),
        "client": (
            "Quote declined",
            "You declined this quote.\n\n"
            "The vendor has been notified. You are welcome to request a new quote or look at other vendors.",
        ),
    },
    "vendor_quote_withdrawn": {
        "client": (
            "Quote withdrawn",
            "The vendor withdrew their quote, so this booking is no longer active.\n\n"
            "You can message them on Eventtz or explore other vendors when you are ready.",
        ),
        "vendor": (
            "Quote withdrawn",
            "You withdrew your quote.\n\n"
            "The client has been notified. Thank you for keeping things clear with them.",
        ),
    },
    "payment_received": {
        "client": (
            "Payment received",
            "Thank you. Your payment went through successfully.\n\n"
            "We will hold the funds safely until the event is complete. "
            "Afterwards, please confirm that everything went well so the vendor can be paid.",
        ),
        "vendor": (
            "Payment received",
            "The client has paid for this booking.\n\n"
            "Your payout is released after the event is confirmed complete. "
            "We will keep you updated every step of the way.",
        ),
    },
    "vendor_payment_received": {
        "vendor": (
            "Payment received",
            "The client has paid for this booking. Thank you for waiting patiently.\n\n"
            "Confirm when the event is done to receive your payout sooner. "
            "If neither of you confirms, payment is released automatically 48 hours after the event "
            "unless a problem is reported.",
        ),
        "client": (
            "Payment sent",
            "Your payment has been sent and the vendor has been notified.\n\n"
            "We are looking after the funds until the event is complete. "
            "You can still message the vendor on Eventtz if you need to.",
        ),
    },
    "vendor_payout_released": {
        "vendor": (
            "Payout sent",
            "Your payout for this booking has been released.\n\n"
            "It should arrive in your connected account shortly, depending on your bank. "
            "Thank you for completing this booking with Eventtz.",
        ),
        "client": (
            "Payout released",
            "The vendor has received their payout for this booking.\n\n"
            "Thank you for completing your booking on Eventtz. We hope your event was a success.",
        ),
    },
    "payment_refunded": {
        "client": (
            "Refund issued",
            "A refund has been issued for this booking.\n\n"
            "It should reach your card within 5 to 10 working days, depending on your bank. "
            "If you need help, just reply or contact support.",
        ),
        "vendor": (
            "Refund issued",
            "The client was refunded for this booking.\n\n"
            "The payment side of this booking is now closed. Thank you for your understanding.",
        ),
    },
    "completion_confirmed_awaiting_other_party": {
        "client": (
            "Confirm completion",
            "The other party has marked this booking as complete.\n\n"
            "Please confirm on your side when you can, so the vendor can be paid. "
            "If something did not go as planned, report a problem from the booking instead.",
        ),
        "vendor": (
            "Confirm completion",
            "The other party has marked this booking as complete.\n\n"
            "Please confirm on your side when you can, so your payout can be released. "
            "Thank you for wrapping this one up promptly.",
        ),
    },
    "completion_reminder": {
        "client": (
            "How did your event go?",
            "We hope your event went well.\n\n"
            "If everything was as expected, please confirm the booking is complete. "
            "If something went wrong, report a problem before the automatic payout date so we can help.",
        ),
    },
    "vendor_completion_reminder": {
        "vendor": (
            "Confirm to get paid",
            "Your event date has passed.\n\n"
            "Please confirm the booking is complete to receive your payout sooner. "
            "If the client does not respond, payment is released automatically unless they report a problem.",
        ),
    },
    "enquiry_reminder_1h": {
        "vendor": (
            "Reminder: booking request waiting",
            "A client is still waiting for your reply on Eventtz.\n\n"
            "Please open the booking to accept, decline, or send a message. "
            "Quick replies help you win more work.",
        ),
    },
    "enquiry_reminder_6h": {
        "vendor": (
            "Still waiting for your reply",
            "This booking request has been waiting for several hours.\n\n"
            "Please respond when you can — clients often look elsewhere if they do not hear back.",
        ),
    },
    "enquiry_reminder_24h": {
        "vendor": (
            "Last reminder: client waiting 24 hours",
            "A client has been waiting a full day for your reply.\n\n"
            "Please accept, decline, or message them now. After this, we may suggest other vendors to the client.",
        ),
    },
    "client_vendor_no_response": {
        "client": (
            "Vendor has not replied yet",
            "Your booking request is still waiting for a vendor reply.\n\n"
            "You can message them from the booking, or browse other vendors for the same search. "
            "Requesting more than one vendor is fine until you pay.",
        ),
    },
    "booking_request_sent": {
        "client": (
            "Request sent",
            "Your booking request is with the vendor.\n\n"
            "We have notified them and will nudge them if they are slow to reply. "
            "Most vendors reply within a day — you can follow everything from your bookings page.",
        ),
    },
}


def format_booking_notification(
    *,
    kind: str,
    portal: Portal,
    event_name: str | None,
    stored_body: str | None,
) -> tuple[str, str | None]:
    """Return (title, body) in plain English."""
    fallback_title, fallback_body = _COPY.get(kind, {}).get(
        portal,
        ("Booking update", stored_body or "Open the booking on Eventtz for the latest details."),
    )

    title = (event_name or "").strip() or fallback_title

    if kind in _USE_STORED_BODY and stored_body and stored_body.strip():
        body = stored_body.strip()
    else:
        body = fallback_body

    return title, body
