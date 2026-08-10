"""Public referral link URLs — always use the live Eventtz domain."""

from __future__ import annotations

from app.features.email.branding import public_email_url


def referral_register_url(slug: str) -> str:
    safe = (slug or "").strip()
    return public_email_url(f"/vendor/register?ref={safe}")
