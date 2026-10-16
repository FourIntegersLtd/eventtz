"""Super-admin payments routes: recover a vendor's lost Stripe Connect account."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentSuperAdmin
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import PaymentGatewayDependency
from app.features.payments import service
from app.features.payments.errors import (
    ConnectAccountResolveFailed,
    PayoutTransferNotFound,
    StripeConnectRestoreFailed,
    StripeNotConfigured,
)
from app.features.payments.schemas import AdminVendorRestoreStripeConnectResponse

router = APIRouter(prefix="/admin/vendors", tags=["admin-payments"])


@router.post(
    "/{user_id}/restore-stripe-connect",
    response_model=AdminVendorRestoreStripeConnectResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        StripeNotConfigured,
        PayoutTransferNotFound,
        ConnectAccountResolveFailed,
        StripeConnectRestoreFailed,
    ),
)
async def admin_restore_vendor_stripe_connect(
    user_id: str, session: SessionDep, admin: CurrentSuperAdmin, gateway: PaymentGatewayDependency
) -> AdminVendorRestoreStripeConnectResponse:
    """Super admin: restore Connect account id from the vendor's latest payout transfer."""
    return await service.restore_connect_from_payout_history(
        session, gateway, vendor_user_id=user_id, actor=admin
    )
