"""Pure rules for building emails: brand constants, public links and the admin alert content."""

from __future__ import annotations

from dataclasses import dataclass, field

APP_NAME = "Eventtz"
COMPANY_LEGAL_NAME = "Eventtz Ltd"
SUPPORT_EMAIL = "hello@eventtz.com"

# Emails always link to the production site, whichever environment sent them.
PUBLIC_WEBSITE = "https://www.eventtz.com"
PUBLIC_WEBSITE_LABEL = "eventtz.com"
PRIVACY_URL = "https://eventtz.com/compliances/privacy-policy"
TERMS_URL = "https://eventtz.com/compliances/terms-of-service"

# Images live on the public S3 bucket, not on the web app.
EMAIL_IMAGE_BASE = "https://eventtz.s3.eu-west-2.amazonaws.com/email"
LOGO_URL = f"{EMAIL_IMAGE_BASE}/eventtz-logo.png"
HERO_URL = f"{EMAIL_IMAGE_BASE}/hero.png"

# Brand colours, matching the web app's globals.css. Templates read them from the context.
BRAND_COLOURS: dict[str, str] = {
    "primary_color": "#3E1964",
    "primary_soft": "#f4f0f8",
    "page_bg": "#ffffff",
    "accent_gold": "#c4a05a",
    "text_color": "#2d2938",
    "text_muted": "#6b6575",
    "text_subtle": "#8a8199",
    "border_color": "rgba(62, 25, 100, 0.14)",
    "canvas_bg": "#ffffff",
    "card_bg": "#ffffff",
    "text_heading": "#1d1d1f",
    "text_secondary": "#6e6e73",
    "hairline": "#e5e5ea",
}

# The coloured label at the top of each kind of admin alert: (text, tone).
ADMIN_ALERT_CHIPS: dict[str, tuple[str, str]] = {
    "admin.contact_submitted": ("CONTACT", "gray"),
    "admin.dispute_opened": ("DISPUTE", "amber"),
    "admin.vendor_submitted": ("REVIEW", "gray"),
    "admin.refund_failed": ("REFUND", "red"),
    "admin.payout_stuck": ("PAYOUT", "red"),
}
DEFAULT_ALERT_CHIP = ("ALERT", "gray")


@dataclass(frozen=True)
class AdminAlert:
    """The content of one ops alert email, before it is rendered.

    `fields` are the label/value rows shown in a table (e.g. `("Portal", "client")`);
    `body` is free text shown below them.
    """

    template_id: str
    subject: str
    headline: str
    intro: str | None = None
    fields: list[tuple[str, str]] = field(default_factory=list)
    body: str | None = None
    action_url: str | None = None
    action_label: str | None = None


def alert_chip(template_id: str) -> tuple[str, str]:
    """The (label, tone) chip for an alert kind; unknown kinds get a grey ALERT chip."""
    return ADMIN_ALERT_CHIPS.get(template_id, DEFAULT_ALERT_CHIP)


def public_url(path: str) -> str:
    """An absolute link on the public website for a path such as `/login`."""
    normalized = path.strip()
    if not normalized:
        return PUBLIC_WEBSITE
    return f"{PUBLIC_WEBSITE}{normalized if normalized.startswith('/') else f'/{normalized}'}"


def admin_sign_in_url() -> str:
    """Where an alert's button sends staff: sign in, then land on the admin dashboard."""
    return public_url("/login?next=/admin/dashboard")


def email_context(**extra: object) -> dict[str, object]:
    """Everything the shared email layout needs (names, links, logo, colours), plus `extra`."""
    context: dict[str, object] = {
        "app_name": APP_NAME,
        "website_url": PUBLIC_WEBSITE,
        "website_label": PUBLIC_WEBSITE_LABEL,
        "login_url": f"{PUBLIC_WEBSITE}/signin",
        "browse_url": f"{PUBLIC_WEBSITE}/client/browse",
        "terms_url": TERMS_URL,
        "privacy_url": PRIVACY_URL,
        "company_legal_name": COMPANY_LEGAL_NAME,
        "support_email": SUPPORT_EMAIL,
        "footer_logo_url": LOGO_URL,
        "hero_image_url": HERO_URL,
        **BRAND_COLOURS,
    }
    context.update(extra)
    return context


def admin_alert_context(alert: AdminAlert) -> dict[str, object]:
    """The template context for `admin/alert.html` and `admin/alert.txt`."""
    chip_label, chip_tone = alert_chip(alert.template_id)
    return email_context(
        subject=alert.subject,
        headline=alert.headline,
        intro=alert.intro,
        fields=alert.fields,
        body=alert.body,
        action_url=alert.action_url,
        action_label=alert.action_label,
        chip_label=chip_label,
        chip_tone=chip_tone,
    )


def contact_submitted_alert(
    *, portal: str, user_email: str | None, subject_label: str, message: str, booking_id: str | None
) -> AdminAlert:
    """The alert staff get for a contact-form submission."""
    fields = [("Portal", portal), ("From", user_email or "unknown"), ("Subject", subject_label)]
    if booking_id:
        fields.append(("Booking", booking_id))
    return AdminAlert(
        template_id="admin.contact_submitted",
        subject=f"[Eventtz contact] {subject_label}",
        headline="New contact message",
        intro="Someone submitted the contact form.",
        fields=fields,
        body=message,
        action_url=admin_sign_in_url(),
        action_label="Sign in to admin",
    )
