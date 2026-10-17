"""Pure rules for vendor moderation emails: submitted alert, approval status, edits, nudges.

Split out of `domain.py` (the admin alert shape) and `domain_account_emails.py` (the
transactional layout) because this file holds vendor-moderation-specific copy. Nothing
here touches Supabase, Resend or the filesystem; `service.py` renders these into
`OutgoingEmail`s.
"""

from __future__ import annotations

from app.core.site import public_url
from app.features.notifications.domain import APP_NAME, SUPPORT_EMAIL, AdminAlert
from app.features.notifications.domain_account_emails import TransactionalEmail, display_name_from_email


def _subject_business_name(business_name: str | None) -> str:
    """The name used in copy: the trimmed business name, or "your profile" when there is none."""
    trimmed = (business_name or "").strip()
    return trimmed or "your profile"


def _greeting_name(business_name: str | None, vendor_email: str) -> str:
    """The name used in a "Hi <name>," greeting: the trimmed business name, or one guessed from the email."""
    trimmed = (business_name or "").strip()
    return trimmed or display_name_from_email(vendor_email)


def vendor_submitted_alert(
    *, vendor_user_id: str, vendor_email: str | None, business_name: str | None
) -> AdminAlert:
    """The staff alert sent when a vendor submits their profile for review."""
    fields: list[tuple[str, str]] = [
        ("Vendor ID", vendor_user_id),
        ("Email", vendor_email or "unknown"),
    ]
    if business_name:
        fields.append(("Business", business_name))
    return AdminAlert(
        template_id="admin.vendor_submitted",
        subject="[Eventtz ops] Vendor profile submitted",
        headline="Vendor submitted for review",
        fields=fields,
        action_url=public_url("/admin/vendors"),
        action_label="Review vendor",
    )


def vendor_approval_status_email(
    *,
    approval_status: str,
    business_name: str | None,
    listing_visible: bool = False,
    payouts_verified: bool = False,
    reason: str | None = None,
) -> TransactionalEmail:
    """Content for a vendor when an admin changes their approval status.

    A `reason` (staff's words for a ban) is quoted in the suspension email with how to reply.

    Which of the four bodies goes out depends on `approval_status` plus the listing
    flags read back *after* the change (live / finish payouts / listing paused /
    suspended / still under review) - see `_notify_vendor_approval_change` in the
    baseline's `vendors/moderation.py`.
    """
    subject_name = _subject_business_name(business_name)
    login_url = public_url("/signin")
    payments_url = public_url("/vendor/payments")
    dashboard_url = public_url("/vendor/dashboard")
    action_url = login_url
    action_label = "Open Eventtz"
    if approval_status == "approved" and listing_visible:
        headline = "Your vendor profile is approved"
        subtitle = "You are live on Eventtz."
        body = (
            f"Congratulations: {subject_name} is now live on Eventtz.\n\n"
            "Clients can find you and send booking requests. "
            "Keep your availability and portfolio up to date."
        )
        action_url = dashboard_url or login_url
        action_label = "Go to dashboard"
    elif approval_status == "approved" and not payouts_verified:
        # Approved, but hidden until Stripe verifies payouts - don't say "live".
        headline = "Your vendor profile is approved"
        subtitle = "One step left before clients can find you."
        body = (
            f"Good news: {subject_name} passed our review.\n\n"
            "Before you go live, set up your payout details so we can pay you for bookings. "
            "Until they are verified, your profile stays hidden from clients. "
            "It usually takes 2-3 minutes, and you go live automatically once it is done."
        )
        action_url = payments_url or login_url
        action_label = "Set up payouts"
    elif approval_status == "approved":
        # Payouts are fine; an admin has paused the public listing.
        headline = "Your vendor profile is approved"
        subtitle = "Your listing is temporarily hidden."
        body = (
            f"Good news: {subject_name} passed our review.\n\n"
            "Our team has paused your public listing for now. "
            "We will email you when clients can find you again."
        )
    elif approval_status == "banned":
        headline = "Your vendor account was suspended"
        subtitle = "You cannot receive new bookings right now."
        body = (
            "We have suspended your vendor account on Eventtz.\n\n"
            "If you believe this was a mistake, or you need help resolving it, "
            "please contact us and we will look into it carefully."
        )
        if reason:
            body = (
                "We have suspended your vendor account on Eventtz.\n\n"
                f"The reason: {reason}\n\n"
                f"If you think this is wrong, reply to this email or write to {SUPPORT_EMAIL} "
                "and we will look into it carefully."
            )
    else:
        headline = "Your vendor profile is under review"
        subtitle = "Thank you for submitting your details."
        body = (
            "Our team is reviewing your profile now.\n\n"
            "We will email you as soon as a decision is made. "
            "You can still sign in and update your details while you wait."
        )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=subtitle,
        body=body,
        action_url=action_url,
        action_label=action_label,
    )


def vendor_returned_for_edits_email(
    *, business_name: str | None, admin_message: str | None = None
) -> TransactionalEmail:
    """Content for "returned for edits": profile unlocked for changes, with or without an admin note."""
    subject_name = _subject_business_name(business_name)
    headline = "Your profile needs a few updates"
    subtitle = "Please complete your details before we can approve you."
    intro = (
        f"We have reviewed {subject_name} and need a few updates before we can approve "
        "your vendor profile on Eventtz."
    )
    note = (admin_message or "").strip()
    if note:
        body = (
            f"{intro}\n\n"
            f"{note}\n\n"
            "Your profile is unlocked so you can edit it now. Read the full message in "
            "Eventtz Support, update your profile, and resubmit when you are ready."
        )
    else:
        body = (
            f"{intro}\n\n"
            "Your profile is unlocked so you can edit it now. Sign in to read what is "
            "missing in Eventtz Support, update your profile, and resubmit when you are ready."
        )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=subtitle,
        body=body,
        action_url=public_url("/vendor/messages"),
        action_label="Read message in Eventtz",
        secondary_action_url=public_url("/vendor/profile"),
        secondary_action_label="Update your profile",
    )


def vendor_complete_profile_nudge_email(
    *, vendor_email: str, business_name: str | None
) -> TransactionalEmail:
    """Content for the nudge sent to a draft vendor who has not submitted their profile."""
    name = _greeting_name(business_name, vendor_email)
    headline = "Thank you for joining Eventtz"
    subtitle = (
        "Eventtz is where clients find you, and where you keep bookings, messages "
        "and payments in one calm place."
    )
    body = (
        f"Hi {name},\n\n"
        "Thank you for joining Eventtz. We are happy to have you on board.\n\n"
        "You have started your vendor profile but have not submitted it yet. When you "
        "have a quiet moment, finishing your application helps clients discover you with "
        "confidence.\n\n"
        "Once you are live on Eventtz, you can:\n"
        "• Show clients your services and prices upfront\n"
        "• Receive booking requests with the date, venue and details in one place\n"
        "• Message clients and agree quotes without switching apps\n"
        "• Get paid securely through Stripe when a booking is confirmed\n\n"
        "Add your photos, services and packages, then submit when you are ready. "
        "Our team will review your application.\n\n"
        f"Questions? Reply to this email or write us at {SUPPORT_EMAIL}."
    )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=subtitle,
        body=body,
        action_url=public_url("/vendor/profile"),
        action_label="Complete your profile",
    )


def vendor_setup_payouts_nudge_email(*, vendor_email: str, business_name: str | None) -> TransactionalEmail:
    """Content for the nudge sent to an approved vendor who has not finished Stripe payout setup."""
    name = _greeting_name(business_name, vendor_email)
    headline = "Set up payouts to go live on Eventtz"
    subtitle = "Your profile is approved — one step left before clients can find you."
    body = (
        f"Hi {name},\n\n"
        "Your vendor profile has been approved on Eventtz. Before clients can discover "
        "you and send booking requests, we need your payout details so we can pay you "
        "when bookings are confirmed.\n\n"
        "It usually takes 2–3 minutes in Stripe. Your listing goes live automatically "
        "once payouts are verified.\n\n"
        f"Questions? Reply to this email or write us at {SUPPORT_EMAIL}."
    )
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=subtitle,
        body=body,
        action_url=public_url("/vendor/payments"),
        action_label="Set up payouts",
        secondary_action_url=public_url("/vendor/dashboard"),
        secondary_action_label="Open dashboard",
    )


def vendor_listing_hidden_email(*, business_name: str | None, reason: str) -> TransactionalEmail:
    """Content telling a vendor staff took their listing down, with the reason and how to appeal."""
    subject_name = _subject_business_name(business_name)
    headline = "Your listing has been hidden"
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle="Clients cannot find you on Eventtz right now.",
        body=(
            f"We have hidden the public listing for {subject_name}.\n\n"
            f"The reason: {reason}\n\n"
            f"If you think this is a mistake, or you have fixed the problem, reply to this email "
            f"or write to {SUPPORT_EMAIL} and we will review it."
        ),
        action_url=public_url("/vendor/dashboard"),
        action_label="Open dashboard",
    )


def vendor_warning_email(*, business_name: str | None, message: str) -> TransactionalEmail:
    """Content for a staff warning to a vendor (for example about repeated cancellations)."""
    subject_name = _subject_business_name(business_name)
    headline = "A message about your Eventtz account"
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle="Please read this. It is a formal warning.",
        body=(
            f"Hi {subject_name},\n\n"
            f"{message}\n\n"
            "This is a warning, not a suspension. If it happens again we may pause or "
            f"suspend your listing. Questions? Reply to this email or write to {SUPPORT_EMAIL}."
        ),
        action_url=public_url("/vendor/dashboard"),
        action_label="Open dashboard",
    )


def vendor_listing_paused_email(
    *, business_name: str | None, reason: str, paused_until_label: str
) -> TransactionalEmail:
    """Content telling a vendor their listing is paused until a date, with the reason."""
    subject_name = _subject_business_name(business_name)
    headline = "Your listing is paused for now"
    return TransactionalEmail(
        subject=f"{headline} | {APP_NAME}",
        title=headline,
        headline=headline,
        subtitle=f"It comes back on its own on {paused_until_label}.",
        body=(
            f"We have paused the public listing for {subject_name} until {paused_until_label}.\n\n"
            f"The reason: {reason}\n\n"
            "You do not need to do anything for it to return. Bookings already made are not "
            f"affected. If you think this is wrong, reply to this email or write to {SUPPORT_EMAIL}."
        ),
        action_url=public_url("/vendor/dashboard"),
        action_label="Open dashboard",
    )
