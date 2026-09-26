"""Pure rules for account emails: verification, password reset/changed, and welcome.

Split out of `domain.py` (which holds the admin alert) because this file has its
own set of image constants and showcase copy. Nothing here touches Supabase,
Resend or the filesystem; `service.py` renders these into `OutgoingEmail`s.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.site import ensure_public_url, public_url
from app.features.notifications.domain import APP_NAME, EMAIL_IMAGE_BASE, SUPPORT_EMAIL, email_context

# Where a staff sign-in link in an account email lands, once they are signed in.
ADMIN_LOGIN_PATH = "/login?next=/admin/dashboard"

# Welcome-email hero and showcase images, alongside the logo/hero already in domain.py.
WELCOME_CLIENTS_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/welcome-clients.png"
WELCOME_VENDORS_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/welcome-vendors.png"
PRICING_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/pricing.png"
BOOK_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/book.png"
CHAT_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/chat.png"
QUOTE_IMAGE_URL = f"{EMAIL_IMAGE_BASE}/quote.png"


@dataclass(frozen=True)
class TransactionalEmail:
    """One headline/subtitle/body email with up to two buttons.

    Rendered with `auth/password_reset.html` (verification, reset, password
    changed) or `booking/notification.html` (the admin welcome) plus their `.txt`
    twins; both templates share this same set of fields. `title` is the `<title>`
    tag text, which the baseline sometimes sets to something other than
    `headline` (the admin welcome); `subject` is the actual email subject line.
    """

    subject: str
    title: str
    headline: str | None
    subtitle: str | None = None
    body: str | None = None
    action_url: str | None = None
    action_label: str | None = None
    secondary_action_url: str | None = None
    secondary_action_label: str | None = None


def transactional_context(email: TransactionalEmail) -> dict[str, object]:
    """The template context for a `TransactionalEmail`."""
    return email_context(
        subject=email.title,
        headline=email.headline,
        subtitle=email.subtitle,
        body=email.body,
        action_url=email.action_url,
        action_label=email.action_label,
        secondary_action_url=email.secondary_action_url,
        secondary_action_label=email.secondary_action_label,
    )


def display_name_from_email(email: str) -> str:
    """A friendly greeting name from the local part of an email address (`jane.doe@x` -> `Jane Doe`)."""
    local = email.split("@", 1)[0].strip()
    if not local:
        return "there"
    cleaned = local.replace(".", " ").replace("_", " ").replace("-", " ")
    return cleaned.title()


def email_verification_email(
    *, verify_url: str, expires_minutes: int, user_type: str | None
) -> TransactionalEmail:
    """Content for "verify your email", sent right after sign-up."""
    role = "vendor" if user_type == "vendor" else "client"
    headline = "Verify your email"
    body = (
        f"Thanks for creating your {APP_NAME} {role} account.\n\n"
        "Click the button below to verify your email address. "
        f"This link expires in {expires_minutes} minutes and can only be used once.\n\n"
        "If you did not create an account, you can ignore this email."
    )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle="Confirm your address to sign in",
        body=body,
        action_url=ensure_public_url(verify_url),
        action_label="Verify email",
    )


def password_reset_email(
    *,
    reset_url: str,
    expires_minutes: int,
    user_type: str | None,
    purpose: Literal["reset", "setup"],
) -> TransactionalEmail:
    """Content for a password reset link, or an admin's first-time password setup link."""
    is_admin = user_type == "admin"
    if is_admin and purpose == "setup":
        headline = "Welcome to the admin team"
        intro = (
            "An administrator added you to Eventtz. "
            "Use the link below to set your password, then sign in with this email address."
        )
        action_label = "Set up password"
        subtitle = None
    elif is_admin:
        headline = "Reset your admin password"
        intro = "We received a request to reset your Eventtz admin console password."
        action_label = "Reset password"
        subtitle = "One-click secure link"
    else:
        headline = "Reset your password"
        intro = "We received a request to reset your Eventtz password."
        action_label = "Reset password"
        subtitle = "One-click secure link"
    body = f"{intro}\n\nThis link expires in {expires_minutes} minutes and can only be used once. " + (
        "If you were not expecting this invite, contact a colleague or reply to this email."
        if is_admin and purpose == "setup"
        else "If you did not ask for a reset, you can ignore this email."
    )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=subtitle,
        body=body,
        action_url=ensure_public_url(reset_url),
        action_label=action_label,
    )


def password_changed_email(*, user_type: str | None) -> TransactionalEmail:
    """Content for the "your password was changed" security notice."""
    login_path = ADMIN_LOGIN_PATH if user_type == "admin" else "/login"
    headline = "Your password was changed"
    body = (
        f"Your {APP_NAME} password was changed successfully.\n\n"
        "If you did not make this change, please contact support right away and we will help."
    )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle="Security notice",
        body=body,
        action_url=public_url(login_path),
        action_label="Sign in",
    )


def admin_welcome_email() -> TransactionalEmail:
    """Content for the admin team's welcome email (a staff member was invited)."""
    title = f"Welcome to {APP_NAME} admin"
    return TransactionalEmail(
        subject=f"{title} | {APP_NAME}",
        title=title,
        headline="Welcome to the admin team",
        subtitle=None,
        body=(
            f"An administrator added you to {APP_NAME}. "
            "Sign in with the email address this message was sent to."
        ),
        action_url=public_url(ADMIN_LOGIN_PATH),
        action_label="Sign in",
    )


@dataclass(frozen=True)
class ShowcaseSection:
    """One panel of the welcome email's "how it works" walkthrough."""

    eyebrow: str
    title: str
    description: str
    image_url: str
    image_alt: str
    tone: Literal["soft", "white"]


def client_welcome_showcase() -> list[ShowcaseSection]:
    """The four-step "how Eventtz works" walkthrough shown to a new client."""
    return [
        ShowcaseSection(
            eyebrow="First step",
            title="See prices before you DM",
            description=(
                'No more "how much?" in Instagram comments and DMs. '
                "Browse vendors with their services and prices already listed."
            ),
            image_url=PRICING_IMAGE_URL,
            image_alt="Vendor pricing on Eventtz",
            tone="soft",
        ),
        ShowcaseSection(
            eyebrow="When you are ready",
            title="Send one proper request",
            description=(
                "Found someone you like? Pick the service, add your date and venue, "
                "and send a booking request. Everything stays on one thread."
            ),
            image_url=BOOK_IMAGE_URL,
            image_alt="Request a booking on Eventtz",
            tone="white",
        ),
        ShowcaseSection(
            eyebrow="Sort the details",
            title="Talk it through on Eventtz",
            description=(
                "Need to tweak the menu, add extra hours, or change the guest count? "
                "Message the vendor and agree the plan without leaving the app."
            ),
            image_url=CHAT_IMAGE_URL,
            image_alt="Chat with a vendor on Eventtz",
            tone="soft",
        ),
        ShowcaseSection(
            eyebrow="When you are happy",
            title="Pay with peace of mind",
            description=(
                "The vendor confirms the final price first. You pay when the details "
                "are clear, not before. We hold your payment safely until the event is done."
            ),
            image_url=QUOTE_IMAGE_URL,
            image_alt="Vendor quote confirmation on Eventtz",
            tone="white",
        ),
    ]


def vendor_welcome_showcase() -> list[ShowcaseSection]:
    """The four-step "how Eventtz works" walkthrough shown to a new vendor."""
    return [
        ShowcaseSection(
            eyebrow="Start here",
            title="Show clients what you do",
            description=(
                "Add your photos, services and prices so people know what you offer "
                "before they reach out. A clear profile invites the right enquiries."
            ),
            image_url=PRICING_IMAGE_URL,
            image_alt="Vendor profile on Eventtz",
            tone="soft",
        ),
        ShowcaseSection(
            eyebrow="New business",
            title="Requests come to you",
            description=(
                "When a client wants to book you, you get the date, venue and service "
                "in one place. No more lost WhatsApp chats."
            ),
            image_url=BOOK_IMAGE_URL,
            image_alt="Booking request on Eventtz",
            tone="white",
        ),
        ShowcaseSection(
            eyebrow="Stay in sync",
            title="Quote and agree in one chat",
            description=(
                "Talk through the details with your client and send a clear quote without switching apps."
            ),
            image_url=CHAT_IMAGE_URL,
            image_alt="Vendor messaging on Eventtz",
            tone="soft",
        ),
        ShowcaseSection(
            eyebrow="Get paid",
            title="Payments handled properly",
            description=(
                "Clients pay through Eventtz once the booking is confirmed. "
                "Your payout goes to you via Stripe Connect."
            ),
            image_url=QUOTE_IMAGE_URL,
            image_alt="Secure checkout on Eventtz",
            tone="white",
        ),
    ]


@dataclass(frozen=True)
class WelcomeEmail:
    """The content of a client or vendor welcome email, rendered with `marketing/welcome.html`."""

    display_name: str
    welcome_subtitle: str
    showcase_eyebrow: str
    showcase_intro: str
    showcase_sections: list[ShowcaseSection]
    welcome_cta_lead: str
    welcome_cta_label: str
    welcome_cta_url: str
    welcome_support_line: str
    hero_image_url: str


def welcome_email(*, email: str, user_type: Literal["client", "vendor"]) -> WelcomeEmail:
    """Content for the client or vendor welcome email, sent after account creation."""
    name = display_name_from_email(email)
    if user_type == "vendor":
        return WelcomeEmail(
            display_name=name,
            welcome_subtitle=(
                f"Welcome aboard. "
                f"{APP_NAME} is where clients find you, and where you keep bookings, messages "
                "and payments in one calm place."
            ),
            showcase_eyebrow="How it works for vendors",
            showcase_intro=(
                "A short tour of what happens once your profile is live. "
                "Take it step by step; we are here if you need a hand."
            ),
            showcase_sections=vendor_welcome_showcase(),
            welcome_cta_lead=(
                "When you have a quiet moment, finish your profile so clients can discover you "
                "with confidence."
            ),
            welcome_cta_label="Go to your dashboard",
            welcome_cta_url=public_url("/vendor/dashboard"),
            welcome_support_line=(
                f"Questions? Reply to this email or write us at {SUPPORT_EMAIL}. We are glad you are here."
            ),
            hero_image_url=WELCOME_VENDORS_IMAGE_URL,
        )
    return WelcomeEmail(
        display_name=name,
        welcome_subtitle=(
            "Welcome aboard. "
            "Whether it is your next owambe, birthday or baby shower, "
            "we are here to help you find vendors you can trust."
        ),
        showcase_eyebrow="A gentle start",
        showcase_intro=(
            "Here is how most people use Eventtz when planning an event. No rush; browse at your own pace."
        ),
        showcase_sections=client_welcome_showcase(),
        welcome_cta_lead="Ready when you are: browse vendors and send your first request.",
        welcome_cta_label="Find vendors",
        welcome_cta_url=public_url("/client/browse"),
        welcome_support_line=(
            f"Got questions? Reply to this email or write us at {SUPPORT_EMAIL}. We are happy to help."
        ),
        hero_image_url=WELCOME_CLIENTS_IMAGE_URL,
    )


def welcome_context(welcome: WelcomeEmail) -> dict[str, object]:
    """The template context for `marketing/welcome.html` and its `.txt` twin."""
    return email_context(
        display_name=welcome.display_name,
        welcome_subtitle=welcome.welcome_subtitle,
        showcase_eyebrow=welcome.showcase_eyebrow,
        showcase_intro=welcome.showcase_intro,
        # The baseline renders the same intro text in both the HTML (rich) and plain-text slot.
        showcase_intro_plain=welcome.showcase_intro,
        showcase_sections=[
            {
                "eyebrow": section.eyebrow,
                "title": section.title,
                "description": section.description,
                "image_url": section.image_url,
                "image_alt": section.image_alt,
                "tone": section.tone,
            }
            for section in welcome.showcase_sections
        ],
        welcome_cta_lead=welcome.welcome_cta_lead,
        welcome_cta_label=welcome.welcome_cta_label,
        welcome_cta_url=welcome.welcome_cta_url,
        welcome_support_line=welcome.welcome_support_line,
        hero_image_url=welcome.hero_image_url,
    )
