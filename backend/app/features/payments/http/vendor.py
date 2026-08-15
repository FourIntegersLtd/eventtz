"""HTTP routes for vendor payout setup via Stripe and the vendor payout ledger."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_vendor
from app.core.logging import get_logger
from app.contracts.payments import (
    VendorPaymentsConnectResponse,
    VendorPaymentsStatusResponse,
    VendorPayoutHistoryResponse,
)
from app.features.bookings.payout_history import list_vendor_payouts
from app.features.payments.stripe import (
    create_connect_onboarding_link,
    get_vendor_connect_status_response,
)

router = APIRouter(prefix="/vendor/payments", tags=["vendor-payments"])
logger = get_logger(__name__)


@router.post("/connect-account", response_model=VendorPaymentsConnectResponse)
def post_connect_account(
    request: Request,
    response: Response,
    return_path: str = "/vendor/payments",
) -> VendorPaymentsConnectResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    onboarding_url = create_connect_onboarding_link(uid, return_path=return_path)
    return VendorPaymentsConnectResponse(onboarding_url=onboarding_url)


@router.get("/status", response_model=VendorPaymentsStatusResponse)
def get_vendor_stripe_connect_status(request: Request, response: Response) -> VendorPaymentsStatusResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    data = get_vendor_connect_status_response(uid)
    return VendorPaymentsStatusResponse(**data)


@router.get("/history", response_model=VendorPayoutHistoryResponse)
def get_payout_history(request: Request, response: Response) -> VendorPayoutHistoryResponse:
    """Vendor earnings ledger: their share only, not the client total Eventtz charged."""
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return VendorPayoutHistoryResponse(**list_vendor_payouts(uid))
