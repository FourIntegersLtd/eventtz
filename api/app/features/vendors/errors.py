"""Errors the vendors slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import Conflict, Forbidden, InvalidInput, NotFound

# --- profile form -------------------------------------------------------------------------------


class ProfileInvalid(InvalidInput):
    """A profile field breaks an onboarding rule; the message names the step and the field to fix."""

    code = "vendor_profile_invalid"
    default_message = "Check your profile details and try again."


class BusinessNameTaken(Conflict):
    """Another vendor already uses this business name (compared ignoring case and extra spaces)."""

    code = "business_name_taken"
    default_message = "This business name is already registered."


# --- moderation ----------------------------------------------------------------------------------


class VendorProfileNotFound(NotFound):
    """The user has no vendor profile row."""

    code = "vendor_profile_not_found"
    default_message = "Vendor profile not found."


class ApprovalStatusInvalid(InvalidInput):
    """The approval status is not pending, approved or banned."""

    code = "approval_status_invalid"
    default_message = "approval_status must be pending, approved, or banned"


class OnlySubmittedToDraft(InvalidInput):
    """Only a submitted profile can be returned to the vendor for edits."""

    code = "only_submitted_to_draft"
    default_message = "Only submitted profiles can be returned to draft."


class OnlyPendingToDraft(InvalidInput):
    """A profile already approved or banned cannot be returned for edits."""

    code = "only_pending_to_draft"
    default_message = "Only pending vendors can be returned to draft."


class ListingOverrideInvalid(InvalidInput):
    """The listing override is not auto, visible or hidden."""

    code = "listing_override_invalid"
    default_message = "listing_override must be auto, visible, or hidden"


class ListingOverrideReasonRequired(InvalidInput):
    """Forcing a listing visible or hidden needs a reason for the audit log."""

    code = "listing_override_reason_required"
    default_message = "Give a reason when overriding a vendor's listing."


class ListingOverrideSuperAdminOnly(Forbidden):
    """Only a super admin may force a listing visible or hidden; others may only reset it to auto."""

    code = "listing_override_super_admin_only"
    default_message = "Only super admins can force a vendor listing visible or hidden."


class InsuranceCertificateMissing(Conflict):
    """Staff tried to record insurance for a vendor who has not uploaded a certificate."""

    code = "insurance_certificate_missing"
    default_message = "This vendor has not uploaded an insurance certificate."


class InsuranceAlreadyExpired(InvalidInput):
    """The expiry date staff entered is today or earlier, so the cover would not count."""

    code = "insurance_already_expired"
    default_message = "The cover must end after today. Ask the vendor for their current certificate."


class InsuranceCoverTooLow(InvalidInput):
    """The cover on the certificate is below the minimum Eventtz accepts."""

    code = "insurance_cover_too_low"
    default_message = "Public liability cover must be at least £1,000,000."


class ListingMediaUrlInvalid(InvalidInput):
    """Staff picked a listing photo that is not the vendor's profile photo or a portfolio image."""

    code = "listing_media_url_invalid"
    default_message = "Listing media overrides must use the vendor profile photo or portfolio images."
