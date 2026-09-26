"""Public and vendor referral routes: the sign-up partner banner, a vendor's client code, code previews."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.errors import AppError, error_responses
from app.features.referrals import service_client_codes, service_partners
from app.features.referrals.errors import (
    CodeAllocationFailed,
    CodeFormatInvalid,
    CodeLocked,
    CodeTaken,
    LinkNotFound,
    ReferralProgrammeClosed,
    ReferralProgrammeNotFound,
)
from app.features.referrals.schemas import (
    ReferralPartnerPublicResponse,
    VendorClientReferralResponse,
    VendorReferralBookingsResponse,
    VendorReferralPreviewResponse,
    VendorReferralSetCodeRequest,
    VendorReferralSetCodeResponse,
)

router = APIRouter()

# The largest spend a preview will price (matches the baseline's query limit).
MAX_PREVIEW_SPEND_GBP = 10_000_000.0


@router.get(
    "/referrals/partners/{slug}",
    tags=["referrals"],
    response_model=ReferralPartnerPublicResponse,
    responses=error_responses(LinkNotFound),
)
def get_partner_for_signup(slug: str) -> ReferralPartnerPublicResponse:
    """The creator named on the vendor sign-up page for a `?ref=` link."""
    return service_partners.public_partner(slug)


@router.get(
    "/vendor/referral",
    tags=["vendor-referrals"],
    response_model=VendorClientReferralResponse,
    responses=error_responses(*ROLE_ERRORS, ReferralProgrammeNotFound),
)
def get_referral_programme(principal: CurrentVendor) -> VendorClientReferralResponse:
    """The vendor's code and share link (blank until set), the service fee and the discount tiers."""
    return service_client_codes.referral_programme(principal.id)


@router.post(
    "/vendor/referral/code",
    tags=["vendor-referrals"],
    response_model=VendorReferralSetCodeResponse,
    responses=error_responses(
        *ROLE_ERRORS, ReferralProgrammeClosed, CodeLocked, CodeFormatInvalid, CodeTaken, CodeAllocationFailed
    ),
)
def choose_referral_code(
    principal: CurrentVendor, body: VendorReferralSetCodeRequest
) -> VendorReferralSetCodeResponse:
    """Set the vendor's code once: the digits they typed, or a random six-digit code when blank."""
    return service_client_codes.choose_code(principal.id, body.code)


@router.get(
    "/vendor/referral/bookings",
    tags=["vendor-referrals"],
    response_model=VendorReferralBookingsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
def list_referral_bookings(principal: CurrentVendor) -> VendorReferralBookingsResponse:
    """Bookings clients made with the vendor's codes, and what the codes saved them."""
    return service_client_codes.referral_bookings(principal.id)


@router.get(
    "/vendors/explore/vendor/{vendor_user_id}/referral-preview",
    tags=["vendor-referrals"],
    response_model=VendorReferralPreviewResponse,
    responses=error_responses(AppError),
)
def preview_referral_code(
    vendor_user_id: str,
    code: str = "",
    vendor_portion_gbp: float = Query(0.0, ge=0.0, le=MAX_PREVIEW_SPEND_GBP),
) -> VendorReferralPreviewResponse:
    """What a client's code would take off the service fee for this spend with this vendor."""
    return service_client_codes.preview(vendor_user_id, code, vendor_portion_gbp)
