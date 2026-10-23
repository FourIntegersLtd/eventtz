"""Errors the vendors slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import AppError, BadGateway, Conflict, Forbidden, InvalidInput, NotFound, PayloadTooLarge

# --- profile form -------------------------------------------------------------------------------


class ProfileInvalid(InvalidInput):
    """A profile field breaks an onboarding rule; the message names the step and the field to fix."""

    code = "vendor_profile_invalid"
    default_message = "Check your profile details and try again."


class BusinessNameTaken(Conflict):
    """Another vendor already uses this business name (compared ignoring case and extra spaces)."""

    code = "business_name_taken"
    default_message = "This business name is already registered."


class ProfileSaveFailed(AppError):
    """500: the profile write succeeded but reading it back found no row (a bug or a concurrent delete)."""

    code = "vendor_profile_save_failed"
    default_message = "Your profile could not be saved. Please try again."


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


# --- onboarding AI: portfolio photo QA ---------------------------------------------------------------


class ImageRequired(InvalidInput):
    """The portfolio photo upload was empty."""

    code = "vendor_onboarding_ai_image_required"
    default_message = "Please choose an image to upload."


class ImageContentTypeInvalid(InvalidInput):
    """The upload's content type is not `image/*`."""

    code = "vendor_onboarding_ai_image_content_type_invalid"
    default_message = "Only image uploads are supported."


class ImageUrlInvalid(InvalidInput):
    """The image URL is missing or not hosted on our upload bucket."""

    code = "vendor_onboarding_ai_image_url_invalid"
    default_message = "Please upload the photo through Eventtz first."


class ImageNotOwned(Forbidden):
    """The image URL is in our bucket but not under the calling vendor's own upload folder."""

    code = "vendor_onboarding_ai_image_not_owned"
    default_message = "You can only analyse photos you uploaded yourself."


class ImageTooLarge(PayloadTooLarge):
    """The stored image is over the image upload limit, so it is not sent to the model."""

    code = "vendor_onboarding_ai_image_too_large"
    default_message = "That photo is too large to analyse."


class ImageNotFound(NotFound):
    """The image URL is one of the caller's own, but no such object is stored."""

    code = "vendor_onboarding_ai_image_not_found"
    default_message = "We could not find that photo. Please upload it again."


class ImageFetchFailed(BadGateway):
    """The uploaded image could not be read back from storage (missing, or storage is down)."""

    code = "vendor_onboarding_ai_image_fetch_failed"
    default_message = "We could not read that photo. Please upload it again."
