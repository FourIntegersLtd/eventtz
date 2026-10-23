"""Errors the notifications slice raises."""

from __future__ import annotations

from app.core.errors import InvalidInput


class UnsupportedWelcomeUserType(InvalidInput):
    """A welcome email was requested for a user type other than client, vendor or admin."""

    code = "unsupported_welcome_user_type"
    default_message = "Unsupported user type for the welcome email."
