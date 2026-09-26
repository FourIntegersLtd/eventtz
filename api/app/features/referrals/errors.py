"""Errors the referrals slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, NotFound, Unavailable

# --- creator partners (staff) ------------------------------------------------------------------


class InvalidSlug(InvalidInput):
    """The chosen slug (or the name it came from) cleans to something that is not a valid slug."""

    code = "referral_slug_invalid"
    default_message = "Slug must use lowercase letters, numbers, and hyphens only."


class DisplayNameRequired(InvalidInput):
    """A new partner's display name is blank once trimmed."""

    code = "referral_display_name_required"
    default_message = "Display name is required."


class DisplayNameEmpty(InvalidInput):
    """An edit tried to blank an existing partner's display name."""

    code = "referral_display_name_empty"
    default_message = "Display name cannot be empty."


class NoFieldsToUpdate(InvalidInput):
    """A partner edit changed nothing."""

    code = "referral_no_fields_to_update"
    default_message = "No fields to update."


class PartnerNotFound(NotFound):
    """No referral partner with that id."""

    code = "referral_partner_not_found"
    default_message = "Referral partner not found"


class SignupNotFound(NotFound):
    """No vendor was attributed to a partner under that user id."""

    code = "referral_signup_not_found"
    default_message = "Referral signup not found"


class LinkNotFound(NotFound):
    """The public sign-up page asked for a slug that is unknown or switched off."""

    code = "referral_link_not_found"
    default_message = "Referral link not found"


class PartnerNotCreated(Unavailable):
    """The partner insert returned nothing and the row could not be read back."""

    code = "referral_partner_not_created"
    default_message = "Could not create referral partner."


# --- vendor client codes -----------------------------------------------------------------------

# The baseline answers "no approved vendor profile" with this copy on every vendor route.
_NO_PROGRAMME = "Referral code not found."


class ReferralProgrammeNotFound(NotFound):
    """Reading referral settings for a vendor with no approved profile yet (GET is a 404)."""

    code = "referral_programme_not_found"
    default_message = _NO_PROGRAMME


class ReferralProgrammeClosed(InvalidInput):
    """Setting a code for a vendor with no approved profile yet (the baseline answers 400 here)."""

    code = "referral_programme_closed"
    default_message = _NO_PROGRAMME


class CodeLocked(InvalidInput):
    """The vendor already has a code; codes never change once set, so shared links keep working."""

    code = "referral_code_locked"
    default_message = (
        "Your referral code is already set and cannot be changed. "
        "Share your existing link or code with clients."
    )


class CodeFormatInvalid(InvalidInput):
    """The chosen code has no digits or more than six."""

    code = "referral_code_format_invalid"
    default_message = "Referral codes must be 1 to 6 digits."


class CodeTaken(InvalidInput):
    """Another vendor already owns the chosen code."""

    code = "referral_code_taken"
    default_message = "That code is already in use. Try another."


class CodeAllocationFailed(Unavailable):
    """Fifty random codes in a row were taken; in practice this means the database is misbehaving."""

    code = "referral_code_allocation_failed"
    default_message = "Could not allocate a unique referral code."
