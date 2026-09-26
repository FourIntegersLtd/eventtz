"""Vendor routes: set up Stripe payouts, read the payout setup status, and the payout ledger."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import PaymentGatewayDependency, PaymentGatewayError, PaymentsUnavailable
from app.features.payments import service
from app.features.payments.errors import (
    StripeConnectRestoreRequired,
    StripeConnectSyncFailed,
    StripeConnectUnavailable,
)
from app.features.payments.schemas import (
    VendorPaymentsConnectResponse,
    VendorPaymentsStatusResponse,
    VendorPayoutHistoryResponse,
)

router = APIRouter(prefix="/vendor/payments", tags=["vendor-payments"])


@router.post(
    "/connect-account",
    response_model=VendorPaymentsConnectResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        StripeConnectUnavailable,
        StripeConnectRestoreRequired,
        StripeConnectSyncFailed,
        PaymentsUnavailable,
        PaymentGatewayError,
    ),
)
async def post_connect_account(
    session: SessionDep,
    vendor: CurrentVendor,
    gateway: PaymentGatewayDependency,
    return_path: str = Query(
        "/vendor/payments", description="Where Stripe sends the vendor back (allowlisted)"
    ),
) -> VendorPaymentsConnectResponse:
    """Create the vendor's Stripe Express account if needed and return its onboarding URL."""
    onboarding_url = await service.start_connect_onboarding(
        session, gateway, vendor.id, return_path=return_path
    )
    return VendorPaymentsConnectResponse(onboarding_url=onboarding_url)


@router.get(
    "/status",
    response_model=VendorPaymentsStatusResponse,
    responses=error_responses(*ROLE_ERRORS, PaymentGatewayError),
)
async def get_vendor_stripe_connect_status(
    session: SessionDep, vendor: CurrentVendor, gateway: PaymentGatewayDependency
) -> VendorPaymentsStatusResponse:
    """The vendor's payout setup, refreshed from Stripe while onboarding is unfinished."""
    return await service.connect_status(session, gateway, vendor.id)


@router.get("/history", response_model=VendorPayoutHistoryResponse, responses=error_responses(*ROLE_ERRORS))
async def get_payout_history(session: SessionDep, vendor: CurrentVendor) -> VendorPayoutHistoryResponse:
    """Vendor earnings ledger: their share only, not the client total Eventtz charged."""
    return await service.payout_history(session, vendor.id)
