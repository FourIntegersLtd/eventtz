"""Super-admin recovery tools for one booking, under `/admin/bookings/{booking_id}/...`.

Each route runs one tool from `service_admin_recovery`, which audits it and answers
with the admin detail view. Plain staff get 403: these tools move money.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentSuperAdmin
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency, PaymentGatewayDependency
from app.features.bookings import errors, service_admin_recovery
from app.features.bookings.schemas import (
    AdminBookingDetailResponse,
    AdminCancelOnBehalfBody,
    AdminConfirmCompletionBody,
    AdminResolveDepositClaimBody,
)

router = APIRouter(prefix="/admin", tags=["admin"])

# Every tool refuses a malformed or missing booking id the same way.
_BOOKING_ERRORS = (*ROLE_ERRORS, errors.InvalidBookingId, errors.RecoveryBookingNotFound)
_PAYOUT_ERRORS = (
    *_BOOKING_ERRORS,
    errors.RecoveryOnlyPaidPayoutRelease,
    errors.RecoveryPayoutNeedsAccepted,
    errors.RecoveryDisputeBlocksPayout,
    errors.RecoveryPayoutNotEligible,
    errors.RecoveryPayoutNotReleased,
    errors.PayoutAmountMissing,
    errors.PayoutReleaseFailed,
)


@router.post(
    "/bookings/{booking_id}/sync-payment",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(
        *_BOOKING_ERRORS,
        errors.RecoveryOnlyAcceptedMarkPaid,
        errors.RecoveryCheckoutSessionNotFound,
        errors.RecoveryNothingToSync,
        errors.RecoveryPaymentIntentNotSucceeded,
        errors.RecoveryPaymentIntentMismatch,
        errors.RecoveryPaymentIntentNoAmount,
        errors.RecoveryMarkPaidFailed,
    ),
)
async def admin_sync_booking_payment(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Ask Stripe whether the client paid and mark the booking paid when they did."""
    return await service_admin_recovery.sync_payment(session, mailer, gateway, staff, booking_id)


@router.post(
    "/bookings/{booking_id}/release-payout",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*_PAYOUT_ERRORS),
)
async def admin_release_booking_payout(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Pay the vendor once both parties confirmed or the automatic payout date has passed."""
    return await service_admin_recovery.release_payout(session, mailer, gateway, staff, booking_id)


@router.post(
    "/bookings/{booking_id}/retry-payout",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*_PAYOUT_ERRORS),
)
async def admin_retry_booking_payout(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Try a failed vendor payout again (the same tool as release-payout, audited as a retry)."""
    return await service_admin_recovery.release_payout(
        session, mailer, gateway, staff, booking_id, action="booking.retry_payout"
    )


@router.post(
    "/bookings/{booking_id}/complete-cancellation",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(
        *_BOOKING_ERRORS,
        errors.RecoveryOnlyRefundedCompleteCancel,
        errors.RecoveryNotAcceptedRefunded,
        errors.RecoveryCouldNotCompleteCancellation,
    ),
)
async def admin_complete_booking_cancellation(
    session: SessionDep, staff: CurrentSuperAdmin, booking_id: str
) -> AdminBookingDetailResponse:
    """Mark a refunded booking cancelled when its cancel stopped halfway."""
    return await service_admin_recovery.complete_cancellation(session, staff, booking_id)


@router.post(
    "/bookings/{booking_id}/cancel-on-behalf",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(
        *_BOOKING_ERRORS,
        errors.RecoveryReasonRequired,
        errors.CancelOnlyPendingOrAccepted,
        errors.CancelCompleteInstead,
        errors.CancelAfterPayout,
        errors.CancelPartialRefund,
        errors.BookingAlreadyRefunded,
        errors.CancelOpenDispute,
        errors.RefundFailed,
        errors.RecoveryOnlyRefundedCompleteCancel,
        errors.RecoveryNotAcceptedRefunded,
        errors.RecoveryCouldNotCompleteCancellation,
        errors.RecoveryCouldNotCancel,
    ),
)
async def admin_cancel_booking_on_behalf(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    body: AdminCancelOnBehalfBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Cancel (and refund, if paid) for the client or vendor who asked support to."""
    return await service_admin_recovery.cancel_on_behalf(
        session,
        mailer,
        gateway,
        staff,
        booking_id,
        party=body.party,
        reason=body.reason,
        exceptional=body.exceptional,
    )


@router.post(
    "/bookings/{booking_id}/confirm-completion",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(
        *_BOOKING_ERRORS,
        errors.CompleteOnlyAccepted,
        errors.RecoveryPaymentRequiredMarkComplete,
        errors.PayoutAmountMissing,
        errors.PayoutReleaseFailed,
    ),
)
async def admin_confirm_booking_completion(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    body: AdminConfirmCompletionBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Confirm the event went ahead for a party; the vendor is paid once both have."""
    return await service_admin_recovery.confirm_completion(
        session, mailer, gateway, staff, booking_id, party=body.party
    )


@router.post(
    "/bookings/{booking_id}/run-maintenance",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*_BOOKING_ERRORS),
)
async def admin_run_booking_maintenance(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Run the post-event step now: the completion reminder, then any payout that is due."""
    return await service_admin_recovery.run_maintenance(session, mailer, gateway, staff, booking_id)


@router.post(
    "/bookings/{booking_id}/deposit-claim/resolve",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(
        *_BOOKING_ERRORS,
        errors.NoDepositClaim,
        errors.DepositAwardInvalid,
        errors.DepositVendorPayoutsNotReady,
        errors.RefundFailed,
        errors.PayoutReleaseFailed,
    ),
)
async def admin_resolve_deposit_claim(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    booking_id: str,
    body: AdminResolveDepositClaimBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> AdminBookingDetailResponse:
    """Decide a vendor's deposit claim: the vendor keeps the award, the client is refunded the rest."""
    return await service_admin_recovery.resolve_deposit_claim(
        session, mailer, gateway, staff, booking_id, body.award_gbp
    )
