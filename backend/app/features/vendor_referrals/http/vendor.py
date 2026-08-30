"""Vendor client referral — authenticated vendor routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.contracts.vendor_referrals import (
    ReferralFeeTier,
    VendorClientReferralResponse,
    VendorReferralBookingsResponse,
    VendorReferralBookingRow,
    VendorReferralSetCodeRequest,
    VendorReferralSetCodeResponse,
)
from app.features.auth.http.guards import require_vendor
from app.features.vendor_referrals import messages as referral_messages
from app.features.vendor_referrals.bookings import list_vendor_referral_bookings
from app.features.vendor_referrals.codes import set_vendor_referral_code
from app.features.vendor_referrals.service import (
    get_vendor_client_referral_info,
    vendor_client_referral_browse_url,
)

router = APIRouter(prefix="/vendor", tags=["vendor-referrals"])


@router.get("/referral", response_model=VendorClientReferralResponse)
def get_vendor_referral(request: Request, response: Response) -> VendorClientReferralResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    info = get_vendor_client_referral_info(uid)
    if not info:
        raise HTTPException(status_code=404, detail=referral_messages.REFERRAL_NOT_FOUND)
    tiers = [ReferralFeeTier(**t) for t in info.get("tiers") or []]
    return VendorClientReferralResponse(
        referral_code=str(info.get("referral_code") or ""),
        has_referral_code=bool(info.get("has_referral_code")),
        share_link=str(info.get("share_link") or ""),
        service_fee_percent=float(info["service_fee_percent"]),
        tiers=tiers,
        enabled=bool(info.get("enabled", True)),
    )


@router.post("/referral/code", response_model=VendorReferralSetCodeResponse)
def post_vendor_referral_code(
    body: VendorReferralSetCodeRequest,
    request: Request,
    response: Response,
) -> VendorReferralSetCodeResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    has_custom = bool(str(body.code or "").strip())
    try:
        code = set_vendor_referral_code(uid, body.code, generate=not has_custom)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return VendorReferralSetCodeResponse(
        referral_code=code,
        share_link=vendor_client_referral_browse_url(uid, code),
    )


@router.get("/referral/bookings", response_model=VendorReferralBookingsResponse)
def get_vendor_referral_bookings(
    request: Request,
    response: Response,
) -> VendorReferralBookingsResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    data = list_vendor_referral_bookings(uid)
    bookings = [VendorReferralBookingRow(**b) for b in data.get("bookings") or []]
    return VendorReferralBookingsResponse(
        total_referral_bookings=int(data.get("total_referral_bookings") or 0),
        total_fee_savings_gbp=float(data.get("total_fee_savings_gbp") or 0),
        bookings=bookings,
    )
