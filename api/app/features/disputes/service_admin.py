"""Use cases for staff triaging and resolving disputes.

Money movement happens before the database patch, exactly as the baseline does it:
if the payments call fails, no resolution is recorded that never actually paid
anyone out or refunded anyone.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.db import as_uuid
from app.core.errors import NoFieldsToUpdate
from app.core.events import publish_after_commit, user_topic
from app.core.ports import Mailer, PaymentGateway
from app.features.bookings import service_payments
from app.features.disputes import domain, repository
from app.features.disputes.errors import (
    AssigneeAdminSuspended,
    AssigneeMustBeAdmin,
    DisputeFinancialResolutionSuperAdminOnly,
    DisputeNotFoundForResolution,
    DisputeNotFoundPlain,
    DisputeRefundAmountSuperAdminOnly,
    InvalidDisputeId,
)
from app.features.disputes.rows import DisputeRow
from app.features.disputes.schemas import AdminDisputeCase, AdminDisputePatchBody
from app.features.identity import service as identity
from app.features.staff import service as staff
from app.features.vendors import service_listing as vendor_listing

# Setting the dispute's status to either of these also stamps `resolved_at`.
_STATUSES_THAT_STAMP_RESOLVED_AT = frozenset({"resolved", "closed"})
# Only a status of exactly "resolved" (not "closed") triggers the money branch below,
# matching the baseline's `if status == "resolved" and resolution_action:` exactly.
_STATUS_THAT_TRIGGERS_MONEY_ACTION = "resolved"

# The patch's plain (non-financial) fields, applied whenever set, verbatim.
_PLAIN_PATCH_FIELDS = (
    "internal_notes",
    "resolution_note",
    "client_resolution_note",
    "vendor_resolution_note",
)


async def list_disputes(session: AsyncSession, *, status: str) -> list[AdminDisputeCase]:
    """Every dispute in the requested status bucket ("open" also surfaces under_review)."""
    cases, _total = await list_disputes_page(session, status=status, search=None, offset=0, limit=500)
    return cases


async def list_disputes_page(
    session: AsyncSession,
    *,
    status: str,
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[AdminDisputeCase], int]:
    """One page of staff disputes plus total count."""
    statuses = domain.status_filter_buckets(status)
    disputes, total = await repository.list_disputes_for_admin_page(
        session, statuses=statuses, search=search, offset=offset, limit=limit
    )
    cases = [await _to_admin_case(session, dispute) for dispute in disputes]
    return cases, total


def _validate_patch_permissions(principal: Principal, patch_fields: dict[str, Any]) -> None:
    """Any staff member may triage a dispute; only a super admin may move money."""
    if patch_fields.get("resolution_action") is not None and not principal.is_super_admin:
        raise DisputeFinancialResolutionSuperAdminOnly()
    if patch_fields.get("refund_amount_gbp") is not None and not principal.is_super_admin:
        raise DisputeRefundAmountSuperAdminOnly()


async def _assert_active_admin_assignee(session: AsyncSession, assigned_admin_id: str) -> None:
    """Only an active (non-suspended) admin account may be assigned a dispute."""
    role = await repository.get_user_role(session, assigned_admin_id)
    if role is None or role.user_type != "admin":
        raise AssigneeMustBeAdmin()
    if role.account_suspended:
        raise AssigneeAdminSuspended()


async def _perform_money_action(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    *,
    booking_request_id: str,
    resolution_action: str,
    refund_amount_gbp: float | None,
) -> None:
    """Carry out the money movement a resolved dispute's `resolution_action` names.

    The bookings slice owns `payment_status`, so it moves the money: `release_to_vendor`
    pays the vendor, `refund_client` refunds in full, `partial_refund` refunds the amount
    already checked against what was paid, and `vendor_no_show` refunds in full like
    `refund_client` but is recorded against the vendor (their cancellation record counts it).
    Its refusals (not paid, Stripe failed) propagate.
    """
    if resolution_action == "release_to_vendor":
        await service_payments.release_payout_for_staff(
            session, mailer, gateway, booking_id=booking_request_id
        )
    elif resolution_action in ("refund_client", "vendor_no_show"):
        await service_payments.refund_booking_for_staff(
            session, mailer, gateway, booking_id=booking_request_id, amount_pence=None
        )
    elif resolution_action == "partial_refund" and refund_amount_gbp is not None:
        await service_payments.refund_booking_for_staff(
            session,
            mailer,
            gateway,
            booking_id=booking_request_id,
            amount_pence=round(refund_amount_gbp * 100),
        )


async def patch_dispute(
    session: AsyncSession,
    mailer: Mailer,
    gateway: PaymentGateway,
    principal: Principal,
    *,
    dispute_id: str,
    body: AdminDisputePatchBody,
) -> AdminDisputeCase:
    """Apply a staff patch: triage fields for anyone, a financial `resolution_action` for super admins."""
    if as_uuid(dispute_id) is None:
        raise InvalidDisputeId()
    patch_fields = body.model_dump(exclude_unset=True)
    if not patch_fields:
        raise NoFieldsToUpdate()
    _validate_patch_permissions(principal, patch_fields)

    status = patch_fields.get("status")
    resolution_action = patch_fields.get("resolution_action")
    if status == _STATUS_THAT_TRIGGERS_MONEY_ACTION and resolution_action:
        dispute = await repository.get_dispute(session, dispute_id)
        if dispute is None:
            raise DisputeNotFoundForResolution()
        refund_amount_gbp = patch_fields.get("refund_amount_gbp")
        if resolution_action == "partial_refund":
            booking = await repository.get_booking(session, dispute.booking_request_id)
            if booking is None:
                raise DisputeNotFoundForResolution()
            domain.check_partial_refund_amount(refund_amount_gbp=refund_amount_gbp, booking=booking)
        await _perform_money_action(
            session,
            mailer,
            gateway,
            booking_request_id=dispute.booking_request_id,
            resolution_action=resolution_action,
            refund_amount_gbp=refund_amount_gbp,
        )

    assigned_admin_id = patch_fields.get("assigned_admin_id")
    if assigned_admin_id:
        await _assert_active_admin_assignee(session, assigned_admin_id)

    values: dict[str, Any] = {}
    if status:
        values["status"] = status
        if status in _STATUSES_THAT_STAMP_RESOLVED_AT:
            values["resolved_at"] = func.now()
    for field_name in _PLAIN_PATCH_FIELDS:
        if field_name in patch_fields:
            values[field_name] = patch_fields[field_name]
    if "assigned_admin_id" in patch_fields:
        values["assigned_admin_id"] = assigned_admin_id or None
    if resolution_action is not None:
        values["resolution_action"] = resolution_action
    if patch_fields.get("refund_amount_gbp") is not None:
        values["refund_amount_gbp"] = patch_fields["refund_amount_gbp"]

    updated = await repository.update_dispute(session, dispute_id, values)
    if updated is None:
        raise DisputeNotFoundPlain()

    await staff.record_admin_action(
        session,
        admin_user_id=principal.id,
        action="dispute.patch",
        entity_type="dispute_case",
        entity_id=dispute_id,
        details=patch_fields,
    )
    booking = await repository.get_booking(session, updated.booking_request_id)
    if booking is not None:
        for recipient_user_id in domain.change_recipients(patch_fields, booking):
            publish_after_commit(session, user_topic(recipient_user_id), domain.DISPUTE_CHANGED)
    return await _to_admin_case(session, updated)


async def _to_admin_case(session: AsyncSession, dispute: DisputeRow) -> AdminDisputeCase:
    """Attach the booking's own fields and every party's email/display name for staff screens."""
    booking = await repository.get_booking(session, dispute.booking_request_id)
    client_email = vendor_email = vendor_name = opened_by_email = assigned_admin_email = None
    opened_by_role = None
    booking_status = event_name = event_date = None
    if booking is not None:
        booking_status = booking.status
        event_name = booking.event_name
        event_date = booking.event_date
        emails = await identity.emails_by_id(session, [booking.client_user_id, booking.vendor_user_id])
        client_email = emails.get(booking.client_user_id)
        vendor_email = emails.get(booking.vendor_user_id)
        vendor_names = await vendor_listing.display_names(session, [booking.vendor_user_id])
        vendor_name = vendor_names.get(booking.vendor_user_id)
        if dispute.opened_by_user_id == booking.client_user_id:
            opened_by_role = "client"
            opened_by_email = client_email
        elif dispute.opened_by_user_id == booking.vendor_user_id:
            opened_by_role = "vendor"
            opened_by_email = vendor_email
    if dispute.assigned_admin_id:
        admin_emails = await identity.emails_by_id(session, [dispute.assigned_admin_id])
        assigned_admin_email = admin_emails.get(dispute.assigned_admin_id)
    return AdminDisputeCase(
        id=dispute.id,
        booking_request_id=dispute.booking_request_id,
        opened_by_user_id=dispute.opened_by_user_id,
        status=dispute.status,
        summary=dispute.summary,
        internal_notes=dispute.internal_notes,
        resolution_note=dispute.resolution_note,
        client_resolution_note=dispute.client_resolution_note,
        vendor_resolution_note=dispute.vendor_resolution_note,
        assigned_admin_id=dispute.assigned_admin_id,
        assigned_admin_email=assigned_admin_email,
        conversation_id=dispute.conversation_id,
        resolution_action=dispute.resolution_action,
        refund_amount_gbp=dispute.refund_amount_gbp,
        created_at=dispute.created_at,
        updated_at=dispute.updated_at,
        resolved_at=dispute.resolved_at,
        event_name=event_name,
        event_date=event_date,
        booking_status=booking_status,
        client_email=client_email,
        vendor_display_name=vendor_name,
        vendor_email=vendor_email,
        opened_by_role=opened_by_role,
        opened_by_email=opened_by_email,
        opened_by_display_name=opened_by_email,
    )
