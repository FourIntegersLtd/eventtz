"""Vendor Stripe Connect onboarding (payouts)."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_vendor
from app.core.logging import get_logger
from app.contracts.payments import VendorPaymentsConnectResponse, VendorPaymentsStatusResponse
from app.features.payments.stripe import create_connect_onboarding_link, sync_connect_account_status

router = APIRouter(prefix="/vendor/payments", tags=["vendor-payments"])
logger = get_logger(__name__)


@router.post("/connect-account", response_model=VendorPaymentsConnectResponse)
def post_connect_account(
    request: Request,
    response: Response,
    return_path: str = "/vendor/onboarding",
) -> VendorPaymentsConnectResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    onboarding_url = create_connect_onboarding_link(uid, return_path=return_path)
    return VendorPaymentsConnectResponse(onboarding_url=onboarding_url)


@router.get("/status", response_model=VendorPaymentsStatusResponse)
def get_status(request: Request, response: Response) -> VendorPaymentsStatusResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    data = sync_connect_account_status(uid)
    return VendorPaymentsStatusResponse(**data)
