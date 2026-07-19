"""Shared Eventtz email branding colours and asset URLs."""

from __future__ import annotations

from app.features.email.constants import (
    APP_NAME,
    COMPANY_LEGAL_NAME,
    EMAIL_IMAGES,
    EMAIL_PRIVACY_URL,
    EMAIL_PUBLIC_WEBSITE,
    EMAIL_PUBLIC_WEBSITE_LABEL,
    EMAIL_SUPPORT_ADDRESS,
    EMAIL_TERMS_URL,
)

# Colours match frontend globals.css and the landing page.
PRIMARY = "#3E1964"
PRIMARY_SOFT = "#f4f0f8"
PAGE_BG = "#ffffff"
ACCENT_GOLD = "#c4a05a"
TEXT = "#2d2938"
TEXT_MUTED = "#6b6575"
TEXT_SUBTLE = "#8a8199"
BORDER = "rgba(62, 25, 100, 0.14)"


def email_public_base() -> str:
    return EMAIL_PUBLIC_WEBSITE.rstrip("/")


def display_name_from_email(email: str) -> str:
    local = (email or "").split("@", 1)[0].strip()
    if not local:
        return "there"
    cleaned = local.replace(".", " ").replace("_", " ").replace("-", " ")
    return cleaned.title()


def base_email_context(**extra: object) -> dict[str, object]:
    base = email_public_base()
    ctx: dict[str, object] = {
        "app_name": APP_NAME,
        "website_url": base,
        "website_label": EMAIL_PUBLIC_WEBSITE_LABEL,
        "login_url": f"{base}/signin",
        "browse_url": f"{base}/client/browse",
        "terms_url": EMAIL_TERMS_URL,
        "privacy_url": EMAIL_PRIVACY_URL,
        "company_legal_name": COMPANY_LEGAL_NAME,
        "support_email": EMAIL_SUPPORT_ADDRESS,
        "footer_logo_url": EMAIL_IMAGES["logo"],
        "hero_image_url": EMAIL_IMAGES["hero"],
        "primary_color": PRIMARY,
        "primary_soft": PRIMARY_SOFT,
        "page_bg": PAGE_BG,
        "accent_gold": ACCENT_GOLD,
        "text_color": TEXT,
        "text_muted": TEXT_MUTED,
        "text_subtle": TEXT_SUBTLE,
        "border_color": BORDER,
    }
    ctx.update(extra)
    return ctx


def transactional_email_context(**extra: object) -> dict[str, object]:
    """Shared layout fields for booking and admin emails."""
    return base_email_context(**extra)


def client_welcome_showcase() -> list[dict[str, str]]:
    return [
        {
            "eyebrow": "First step",
            "title": "See prices before you DM",
            "description": (
                "No more \"how much?\" in Instagram comments and DMs. "
                "Browse vendors with their services and prices already listed."
            ),
            "image_url": EMAIL_IMAGES["pricing"],
            "image_alt": "Vendor pricing on Eventtz",
            "tone": "soft",
        },
        {
            "eyebrow": "When you are ready",
            "title": "Send one proper request",
            "description": (
                "Found someone you like? Pick the service, add your date and venue, "
                "and send a booking request. Everything stays on one thread."
            ),
            "image_url": EMAIL_IMAGES["book"],
            "image_alt": "Request a booking on Eventtz",
            "tone": "white",
        },
        {
            "eyebrow": "Sort the details",
            "title": "Talk it through on Eventtz",
            "description": (
                "Need to tweak the menu, add extra hours, or change the guest count? "
                "Message the vendor and agree the plan without leaving the app."
            ),
            "image_url": EMAIL_IMAGES["chat"],
            "image_alt": "Chat with a vendor on Eventtz",
            "tone": "soft",
        },
        {
            "eyebrow": "When you are happy",
            "title": "Pay with peace of mind",
            "description": (
                "The vendor confirms the final price first. You pay when the details "
                "are clear, not before. We hold your payment safely until the event is done."
            ),
            "image_url": EMAIL_IMAGES["quote"],
            "image_alt": "Vendor quote confirmation on Eventtz",
            "tone": "white",
        },
    ]


def vendor_welcome_showcase() -> list[dict[str, str]]:
    return [
        {
            "eyebrow": "Start here",
            "title": "Show clients what you do",
            "description": (
                "Add your photos, services and prices so people know what you offer "
                "before they reach out. A clear profile invites the right enquiries."
            ),
            "image_url": EMAIL_IMAGES["pricing"],
            "image_alt": "Vendor profile on Eventtz",
            "tone": "soft",
        },
        {
            "eyebrow": "New business",
            "title": "Requests come to you",
            "description": (
                "When a client wants to book you, you get the date, venue and service "
                "in one place. No more lost WhatsApp chats."
            ),
            "image_url": EMAIL_IMAGES["book"],
            "image_alt": "Booking request on Eventtz",
            "tone": "white",
        },
        {
            "eyebrow": "Stay in sync",
            "title": "Quote and agree in one chat",
            "description": (
                "Talk through the details with your client and send a clear quote "
                "without switching apps."
            ),
            "image_url": EMAIL_IMAGES["chat"],
            "image_alt": "Vendor messaging on Eventtz",
            "tone": "soft",
        },
        {
            "eyebrow": "Get paid",
            "title": "Payments handled properly",
            "description": (
                "Clients pay through Eventtz once the booking is confirmed. "
                "Your payout goes to you via Stripe Connect."
            ),
            "image_url": EMAIL_IMAGES["quote"],
            "image_alt": "Secure checkout on Eventtz",
            "tone": "white",
        },
    ]
