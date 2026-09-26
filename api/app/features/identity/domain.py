"""How a client is named on vendor-facing screens, without ever showing their email. Pure."""

from __future__ import annotations

# What a vendor sees for a client who has deleted their account.
DELETED_USER_DISPLAY = "Deleted user"
# The last resort when a client has no preferred name and no usable email.
CLIENT_FALLBACK_DISPLAY = "Client"
# Characters in an email's local part that separate words ("jane.doe_92" -> "Jane Doe").
_WORD_SEPARATORS = (".", "_", "-")


def friendly_name_from_email(email: str | None) -> str | None:
    """A readable name from an email's local part: separators become spaces, number-only words drop.

    `jane.doe_92@example.com` gives `Jane Doe`; an address with no letters left gives `None`.
    """
    if not email or "@" not in email:
        return None
    local_part = email.split("@", 1)[0].strip()
    for separator in _WORD_SEPARATORS:
        local_part = local_part.replace(separator, " ")
    words = [word.capitalize() for word in local_part.split() if not word.isdigit()]
    return " ".join(words) or None


def client_display_name(*, email: str | None, preferred_name: str | None, deleted: bool) -> str:
    """A vendor sees "Deleted user", else the preferred name, else a name from the email, or "Client"."""
    if deleted:
        return DELETED_USER_DISPLAY
    if isinstance(preferred_name, str) and preferred_name.strip():
        return preferred_name.strip()
    return friendly_name_from_email(email) or CLIENT_FALLBACK_DISPLAY
