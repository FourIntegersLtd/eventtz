"""Email defaults - only RESEND_API_KEY is read from the environment."""

from __future__ import annotations

COMPANY_LEGAL_NAME = "Eventtz Ltd"
EMAIL_SUPPORT_ADDRESS = "hello@eventtz.com"
EMAIL_FROM = f"Eventtz <{EMAIL_SUPPORT_ADDRESS}>"
EMAIL_ENABLED = True

ADMIN_NOTIFY_RECIPIENTS: tuple[str, ...] = (
    EMAIL_SUPPORT_ADDRESS,
    "y.hkehinde@yahoo.com",
    "sheinat03@gmail.com",
)

APP_NAME = "Eventtz"

# Always use the production site in emails, not FRONTEND_URL or localhost.
EMAIL_PUBLIC_WEBSITE = "https://www.eventtz.com"
EMAIL_PUBLIC_WEBSITE_LABEL = "eventtz.com"
EMAIL_PRIVACY_URL = "https://eventtz.com/compliances/privacy-policy"
EMAIL_TERMS_URL = "https://eventtz.com/compliances/terms-of-service"

# Images hosted on the Eventtz public S3 bucket (not tied to FRONTEND_URL).
EMAIL_IMAGE_BASE = "https://eventtz.s3.eu-west-2.amazonaws.com/email"
EMAIL_IMAGES: dict[str, str] = {
    "logo": f"{EMAIL_IMAGE_BASE}/eventtz-logo.png",
    "hero": f"{EMAIL_IMAGE_BASE}/hero.png",
    "welcome_clients": f"{EMAIL_IMAGE_BASE}/welcome-clients.png",
    "welcome_vendors": f"{EMAIL_IMAGE_BASE}/welcome-vendors.png",
    "pricing": f"{EMAIL_IMAGE_BASE}/pricing.png",
    "book": f"{EMAIL_IMAGE_BASE}/book.png",
    "chat": f"{EMAIL_IMAGE_BASE}/chat.png",
    "quote": f"{EMAIL_IMAGE_BASE}/quote.png",
}

# Booking email kinds we only send once per person per booking.
EMAIL_DEDUPE_KINDS: frozenset[str] = frozenset(
    {
        "booking_completed",
        "booking_request_sent",
        "payment_received",
        "payment_receipt",
        "vendor_payment_received",
        "vendor_payment_record",
        "vendor_payout_released",
        "vendor_payout_statement",
        "payment_refunded",
        "completion_reminder",
        "vendor_completion_reminder",
        "enquiry_reminder_1h",
        "enquiry_reminder_6h",
        "enquiry_reminder_24h",
        "client_vendor_no_response",
        "event_tomorrow",
        "vendor_event_tomorrow",
        "pay_to_confirm",
    }
)
