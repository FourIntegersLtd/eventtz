"""Staff routes: list disputes by status, and patch one (triage fields for anyone, money for super admins)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency
from app.features.disputes import errors, service_admin
from app.features.disputes.schemas import AdminDisputeCase, AdminDisputePatchBody, AdminDisputesListResponse

router = APIRouter(prefix="/admin", tags=["admin"])

_STATUS_QUERY = Query("all", description="all, open, under_review, resolved, or closed")


@router.get(
    "/disputes",
    response_model=AdminDisputesListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.DisputeStatusFilterInvalid),
)
async def list_admin_disputes(
    session: SessionDep, staff: CurrentStaff, status: str = _STATUS_QUERY
) -> AdminDisputesListResponse:
    """Every dispute in the requested status bucket ("open" also surfaces under_review)."""
    disputes = await service_admin.list_disputes(session, status=status)
    return AdminDisputesListResponse(disputes=disputes)


@router.patch(
    "/disputes/{dispute_id}",
    response_model=AdminDisputeCase,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidDisputeId,
        errors.NoFieldsToUpdate,
        errors.DisputeFinancialResolutionSuperAdminOnly,
        errors.DisputeRefundAmountSuperAdminOnly,
        errors.DisputeNotFoundForResolution,
        errors.RefundAmountRequiredForPartialRefund,
        errors.OnlyPaidBookingsCanBePartiallyRefunded,
        errors.NoRecordedPaymentAmount,
        errors.PartialRefundOutOfRange,
        errors.AssigneeMustBeAdmin,
        errors.AssigneeAdminSuspended,
        errors.DisputeMoneyActionNotRebuilt,
        errors.DisputeNotFoundPlain,
    ),
)
async def patch_admin_dispute(
    session: SessionDep,
    staff: CurrentStaff,
    dispute_id: str,
    body: AdminDisputePatchBody,
    mailer: MailerDependency,
) -> AdminDisputeCase:
    """Triage or resolve a dispute; only a super admin may set a financial `resolution_action`.

    No `PaymentGatewayDependency` here yet: `core.ports.payment_gateway_port` is not wired
    in `app.main.create_app` until the payments slice (ws1) lands. The money branch below
    is a placeholder that never reaches Stripe, so it needs no gateway to raise.
    """
    return await service_admin.patch_dispute(session, mailer, staff, dispute_id=dispute_id, body=body)
