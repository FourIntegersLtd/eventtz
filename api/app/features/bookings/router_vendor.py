"""Vendor routes: quotes, the bookings list and detail, answering requests, price changes, completion."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import InvalidBookingId, error_responses
from app.core.pagination import PageDep
from app.core.ports import MailerDependency, PaymentGatewayDependency
from app.features.bookings import (
    errors,
    service_adjustments,
    service_completion,
    service_create,
    service_date_change,
    service_deposits,
    service_portal_dashboard,
    service_queries,
    service_receipts,
    service_status,
)
from app.features.bookings.schemas import (
    BookingRequestCreated,
    ConfirmCompletionResponse,
    CreateVendorQuoteBody,
    DateChangeRequestBody,
    DateChangeRespondBody,
    DepositClaimBody,
    PaymentReceiptResponse,
    PutVendorBookingAdjustmentsBody,
    PutVendorBookingAdjustmentsResponse,
    VendorBookingDetailResponse,
    VendorBookingsListResponse,
    VendorBookingStatusBody,
    VendorBookingStatusResponse,
    VendorDashboardResponse,
)
from app.features.bookings.service_common import require_booking_id

router = APIRouter(prefix="/vendor", tags=["vendor"])

_GROUP_QUERY = Query("active", description="Filter bucket: active, completed, closed, or all")
_RECEIPT_ERRORS = (
    InvalidBookingId,
    errors.BookingNotFound,
    errors.ReceiptNotAvailable,
)


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
    "/dashboard",
    response_model=VendorDashboardResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_vendor_dashboard(session: SessionDep, vendor: CurrentVendor) -> VendorDashboardResponse:
    """Aggregated home-screen data for the vendor portal."""
    return await service_portal_dashboard.vendor_dashboard(session, vendor)


@router.get(
    "/booking-requests",
    response_model=VendorBookingsListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidListGroup, errors.InvalidPaymentStatusFilter),
)
async def list_vendor_bookings(
    session: SessionDep,
    vendor: CurrentVendor,
    page: PageDep,
    group: str = _GROUP_QUERY,
    status: str | None = Query(None, description="Optional exact booking status, e.g. pending"),
    payment_status: str | None = Query(
        None,
        description="Optional payment_status; several as a comma-separated list, e.g. paid,payout_released",
    ),
    exclude_payment_status: str | None = Query(None, description="Exclude this payment_status"),
    search: str | None = Query(
        None,
        alias="q",
        max_length=200,
        description="Part of an event name or client name.",
    ),
    conversation_id: str | None = Query(None, description="Exact conversation id linked to the booking."),
) -> VendorBookingsListResponse:
    """The vendor's bookings in one bucket, most recently active first."""
    bookings, total = await service_queries.vendor_bookings_page(
        session,
        vendor.id,
        group=group,
        status=status,
        payment_status=payment_status,
        exclude_payment_status=exclude_payment_status,
        search=search,
        conversation_id=conversation_id,
        offset=page.offset,
        limit=page.limit,
    )
    return VendorBookingsListResponse(bookings=bookings, total=total, offset=page.offset, limit=page.limit)


@router.put(
    "/booking-requests/{booking_id}/adjustments",
    response_model=PutVendorBookingAdjustmentsResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        InvalidBookingId,
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
        InvalidBookingId,
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
        InvalidBookingId,
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
    responses=error_responses(*ROLE_ERRORS, InvalidBookingId, errors.BookingNotFound),
)
async def get_vendor_booking(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> VendorBookingDetailResponse:
    """One booking with its price breakdown, the client's contact once paid, and any review."""
    booking = await service_queries.vendor_booking_detail(session, vendor.id, require_booking_id(booking_id))
    return VendorBookingDetailResponse(booking=booking)


@router.get(
    "/booking-requests/{booking_id}/payment-record",
    response_model=PaymentReceiptResponse,
    responses=error_responses(*ROLE_ERRORS, *_RECEIPT_ERRORS),
)
async def get_vendor_booking_payment_record(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> PaymentReceiptResponse:
    """The vendor's payment record once the client has paid."""
    payload = await service_receipts.vendor_payment_record(
        session, vendor_user_id=vendor.id, booking_id=require_booking_id(booking_id)
    )
    return service_receipts.payment_receipt_response(payload)


@router.get(
    "/booking-requests/{booking_id}/payment-record.html",
    response_class=HTMLResponse,
    responses=error_responses(*ROLE_ERRORS, *_RECEIPT_ERRORS),
)
async def get_vendor_booking_payment_record_html(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> HTMLResponse:
    """The vendor's payment record as a downloadable HTML file."""
    payload = await service_receipts.vendor_payment_record(
        session, vendor_user_id=vendor.id, booking_id=require_booking_id(booking_id)
    )
    receipt_number = str(payload.get("receipt_number") or "payment-record")
    return HTMLResponse(
        content=service_receipts.render_receipt_html(payload),
        headers={"Content-Disposition": f'attachment; filename="payment-record-{receipt_number}.html"'},
    )


@router.get(
    "/booking-requests/{booking_id}/payout-statement",
    response_model=PaymentReceiptResponse,
    responses=error_responses(*ROLE_ERRORS, *_RECEIPT_ERRORS),
)
async def get_vendor_booking_payout_statement(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> PaymentReceiptResponse:
    """The vendor's payout statement once their share has been released."""
    payload = await service_receipts.vendor_payout_statement(
        session, vendor_user_id=vendor.id, booking_id=require_booking_id(booking_id)
    )
    return service_receipts.payment_receipt_response(payload)


@router.get(
    "/booking-requests/{booking_id}/payout-statement.html",
    response_class=HTMLResponse,
    responses=error_responses(*ROLE_ERRORS, *_RECEIPT_ERRORS),
)
async def get_vendor_booking_payout_statement_html(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> HTMLResponse:
    """The vendor's payout statement as a downloadable HTML file."""
    payload = await service_receipts.vendor_payout_statement(
        session, vendor_user_id=vendor.id, booking_id=require_booking_id(booking_id)
    )
    receipt_number = str(payload.get("receipt_number") or "payout-statement")
    return HTMLResponse(
        content=service_receipts.render_receipt_html(payload),
        headers={"Content-Disposition": f'attachment; filename="payout-statement-{receipt_number}.html"'},
    )


@router.post(
    "/booking-requests/{booking_id}/date-change",
    response_model=VendorBookingDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        InvalidBookingId,
        errors.BookingNotFound,
        errors.DateChangeNotAllowed,
        errors.DateChangePending,
        errors.DateChangeInPast,
        errors.EventSpanTooLong,
    ),
)
async def post_vendor_date_change(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    body: DateChangeRequestBody,
    mailer: MailerDependency,
) -> VendorBookingDetailResponse:
    """Ask to move an accepted booking to a new date; the other party is asked to agree."""
    booking_id = require_booking_id(booking_id)
    await service_date_change.request_date_change(
        session,
        mailer,
        "vendor",
        vendor.id,
        booking_id,
        body.new_event_date,
        body.new_event_end_date,
        body.note,
    )
    return VendorBookingDetailResponse(
        booking=await service_queries.vendor_booking_detail(session, vendor.id, booking_id)
    )


@router.post(
    "/booking-requests/{booking_id}/date-change/respond",
    response_model=VendorBookingDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        InvalidBookingId,
        errors.BookingNotFound,
        errors.DateChangeNotAllowed,
        errors.NoDateChange,
        errors.DateChangeNotYours,
        errors.DateChangeCapacityFull,
    ),
)
async def post_vendor_date_change_respond(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    body: DateChangeRespondBody,
    mailer: MailerDependency,
) -> VendorBookingDetailResponse:
    """Accept or decline the other party's pending date change."""
    booking_id = require_booking_id(booking_id)
    await service_date_change.respond_to_date_change(
        session, mailer, "vendor", vendor.id, booking_id, accept=body.accept
    )
    return VendorBookingDetailResponse(
        booking=await service_queries.vendor_booking_detail(session, vendor.id, booking_id)
    )


@router.post(
    "/booking-requests/{booking_id}/date-change/withdraw",
    response_model=VendorBookingDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        InvalidBookingId,
        errors.BookingNotFound,
        errors.NoDateChange,
        errors.DateChangeNotYours,
    ),
)
async def post_vendor_date_change_withdraw(
    session: SessionDep, vendor: CurrentVendor, booking_id: str, mailer: MailerDependency
) -> VendorBookingDetailResponse:
    """Take back your own pending date change."""
    booking_id = require_booking_id(booking_id)
    await service_date_change.withdraw_date_change(session, mailer, "vendor", vendor.id, booking_id)
    return VendorBookingDetailResponse(
        booking=await service_queries.vendor_booking_detail(session, vendor.id, booking_id)
    )


@router.post(
    "/booking-requests/{booking_id}/deposit-claim",
    response_model=VendorBookingDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        InvalidBookingId,
        errors.BookingNotFound,
        errors.DepositClaimClosed,
        errors.DepositClaimInvalid,
    ),
)
async def post_vendor_deposit_claim(
    session: SessionDep,
    vendor: CurrentVendor,
    booking_id: str,
    body: DepositClaimBody,
    mailer: MailerDependency,
) -> VendorBookingDetailResponse:
    """Ask to keep part of the client's damage deposit, saying what was damaged or missing; staff decide."""
    booking_id = require_booking_id(booking_id)
    await service_deposits.claim_deposit(
        session,
        mailer,
        vendor_user_id=vendor.id,
        booking_id=booking_id,
        amount_gbp=body.amount_gbp,
        note=body.note,
    )
    return VendorBookingDetailResponse(
        booking=await service_queries.vendor_booking_detail(session, vendor.id, booking_id)
    )
