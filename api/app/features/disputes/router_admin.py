"""Staff routes: list disputes by status, and patch one (triage fields for anyone, money for super admins)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.core.ports import MailerDependency, PaymentGatewayDependency
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
    session: SessionDep,
    staff: CurrentStaff,
    status: str = _STATUS_QUERY,
    search: str | None = Query(None, description="Match summary or booking id"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=200),
) -> AdminDisputesListResponse:
    """Every dispute in the requested status bucket ("open" also surfaces under_review)."""
    disputes, total = await service_admin.list_disputes_page(
        session, status=status, search=search, offset=offset, limit=limit
    )
    return AdminDisputesListResponse(disputes=disputes, total=total, offset=offset, limit=limit)


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
        *errors.MONEY_ACTION_ERRORS,
        errors.DisputeNotFoundPlain,
    ),
)
async def patch_admin_dispute(
    session: SessionDep,
    staff: CurrentStaff,
    dispute_id: str,
    body: AdminDisputePatchBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminDisputeCase:
    """Triage or resolve a dispute; only a super admin may set a financial `resolution_action`.

    Resolving with a `resolution_action` refunds the client or pays the vendor in Stripe
    before the dispute is written, so a failed payment leaves no resolution behind.
    """
    return await service_admin.patch_dispute(
        session, mailer, gateway, staff, dispute_id=dispute_id, body=body
    )
