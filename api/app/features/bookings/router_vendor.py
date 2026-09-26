"""Vendor routes: quotes, the bookings list and detail, answering requests, price changes, completion."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency, PaymentGatewayDependency
from app.features.bookings import (
    errors,
    service_adjustments,
    service_completion,
    service_create,
    service_queries,
    service_status,
)
from app.features.bookings.schemas import (
    BookingRequestCreated,
    ConfirmCompletionResponse,
    CreateVendorQuoteBody,
    PutVendorBookingAdjustmentsBody,
    PutVendorBookingAdjustmentsResponse,
    VendorBookingDetailResponse,
    VendorBookingsListResponse,
    VendorBookingStatusBody,
    VendorBookingStatusResponse,
)
from app.features.bookings.service_common import require_booking_id

router = APIRouter(prefix="/vendor", tags=["vendor"])

_GROUP_QUERY = Query("active", description="Filter bucket: active, completed, closed, or all")


# Declared before `/booking-requests/{booking_id}` routes so "vendor-quote" is never read as an id.
@router.post(
    "/booking-requests/vendor-quote",
    response_model=BookingRequestCreated,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidClientId,
        errors.InvalidConversationId,
        errors.CannotQuoteSelf,
        errors.VendorProfileNotBookable,
        errors.PartySuspended,
        errors.QuoteClientNotFound,
        errors.QuotesClientOnly,
        errors.QuoteClientSuspended,
        errors.EventDatesUnavailable,
        errors.EventSpanTooLong,
        errors.VendorFullOnDate,
        errors.QuoteNeedsLineItem,
        errors.QuoteLineInvalid,
        errors.QuoteLineNeedsPrice,
        errors.QuoteTotalNotPositive,
    ),
)
async def post_vendor_quote(
    session: SessionDep, vendor: CurrentVendor, body: CreateVendorQuoteBody, mailer: MailerDependency
) -> BookingRequestCreated:
    """Send a client a priced quote (optionally from a chat thread); it waits for their answer."""
    return await service_create.create_quote(session, mailer, vendor, body)


@router.get(
    "/booking-requests",
    response_model=VendorBookingsListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidListGroup),
)
async def list_vendor_bookings(
    session: SessionDep,
    vendor: CurrentVendor,
    group: str = _GROUP_QUERY,
    status: str | None = Query(None, description="Optional exact booking status, e.g. pending"),
    payment_status: str | None = Query(None, description="Optional exact payment_status"),
    exclude_payment_status: str | None = Query(None, description="Exclude this payment_status"),
) -> VendorBookingsListResponse:
    """The vendor's bookings in one bucket, most recently active first."""
    bookings = await service_queries.vendor_bookings(
        session,
        vendor.id,
        group=group,
        status=status,
        payment_status=payment_status,
        exclude_payment_status=exclude_payment_status,
    )
    return VendorBookingsListResponse(bookings=bookings)


@router.put(
    "/booking-requests/{booking_id}/adjustments",
    response_model=PutVendorBookingAdjustmentsResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.AdjustmentsNotOnVendorQuote,
        errors.AdjustmentsPendingOnly,
        errors.AdjustmentAmountInvalid,
        errors.AdjustmentOutOfRange,
        errors.SurchargeTooHigh,
        errors.DiscountsTooHigh,
    ),
)
async def put_vendor_booking_adjustments(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    body: PutVendorBookingAdjustmentsBody,
    mailer: MailerDependency,
) -> PutVendorBookingAdjustmentsResponse:
    """Replace the extras and discounts on a pending request; the client must confirm the new price."""
    booking = await service_adjustments.replace_adjustments(
        session, mailer, vendor.id, require_booking_id(booking_id), body
    )
    return PutVendorBookingAdjustmentsResponse(booking=booking)


@router.patch(
    "/booking-requests/{booking_id}/status",
    response_model=VendorBookingStatusResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.CancelOnlyAcceptedOrQuote,
        errors.ClientMustAcceptQuote,
        errors.PayoutSetupRequired,
        errors.ClientMustConfirmPrice,
        errors.AcceptOnlyPendingOrDeclined,
        errors.WithdrawQuoteWithCancel,
        errors.DeclineOnlyPending,
        errors.CancelAfterPayout,
        errors.CancelPartialRefund,
        errors.BookingAlreadyRefunded,
        errors.CancelOpenDispute,
        errors.RefundFailed,
    ),
)
async def patch_vendor_booking_status(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    body: VendorBookingStatusBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> VendorBookingStatusResponse:
    """Accept, decline or cancel a booking (withdrawing a quote is a cancel; a paid one is refunded)."""
    return await service_status.set_vendor_status(
        session, mailer, gateway, vendor.id, require_booking_id(booking_id), body.booking_status
    )


@router.post(
    "/booking-requests/{booking_id}/confirm-completion",
    response_model=ConfirmCompletionResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.CompleteOnlyAccepted,
        errors.CompleteNeedsPayment,
        errors.EventDayNotOver,
        errors.PayoutAmountMissing,
        errors.PayoutReleaseFailed,
    ),
)
async def post_vendor_confirm_completion(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> ConfirmCompletionResponse:
    """Confirm the event went ahead; the payout follows once the client confirms too."""
    return await service_completion.confirm_completion(
        session,
        mailer,
        gateway,
        party="vendor",
        user_id=vendor.id,
        booking_id=require_booking_id(booking_id),
    )


@router.get(
    "/booking-requests/{booking_id}",
    response_model=VendorBookingDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidBookingId, errors.BookingNotFound),
)
async def get_vendor_booking(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> VendorBookingDetailResponse:
    """One booking with its price breakdown, the client's contact once paid, and any review."""
    booking = await service_queries.vendor_booking_detail(session, vendor.id, require_booking_id(booking_id))
    return VendorBookingDetailResponse(booking=booking)
