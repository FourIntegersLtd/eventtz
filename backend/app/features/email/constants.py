"""Email defaults — only RESEND_API_KEY comes from env."""

from __future__ import annotations

EMAIL_FROM = "Eventtz <hello@fourintegers.com>"
EMAIL_ENABLED = True

ADMIN_NOTIFY_RECIPIENTS: tuple[str, ...] = (
    "hello@fourintegers.com",
    "y.hkehinde@yahoo.com",
    "sheinat03@gmail.com",
)

APP_NAME = "Eventtz"

# Public site shown in emails (always production, not FRONTEND_URL / localhost).
EMAIL_PUBLIC_WEBSITE = "https://eventtz.com"
EMAIL_PUBLIC_WEBSITE_LABEL = "eventtz.com"
EMAIL_PRIVACY_URL = "https://eventtz.com/compliances/privacy-policy"
EMAIL_TERMS_URL = "https://eventtz.com/compliances/terms-of-service"

# Hosted on S3 for reliable loading in email clients (not tied to FRONTEND_URL).
EMAIL_IMAGE_BASE = "https://osceguide.s3.eu-west-2.amazonaws.com/Four+Integers+Ltd/eventtz"
EMAIL_IMAGES: dict[str, str] = {
    "logo": f"{EMAIL_IMAGE_BASE}/eventtz-logo.png",
    "hero": f"{EMAIL_IMAGE_BASE}/hero.png",
    "pricing": f"{EMAIL_IMAGE_BASE}/pricing.png",
    "book": f"{EMAIL_IMAGE_BASE}/book.png",
    "chat": f"{EMAIL_IMAGE_BASE}/chat.png",
    "quote": f"{EMAIL_IMAGE_BASE}/quote.png",
}

# Kinds that should dedupe email sends per (template, booking, user).
EMAIL_DEDUPE_KINDS: frozenset[str] = frozenset(
    {
        "booking_completed",
        "payment_received",
        "vendor_payment_received",
        "vendor_payout_released",
        "payment_refunded",
        "completion_reminder",
        "vendor_completion_reminder",
    }
)
