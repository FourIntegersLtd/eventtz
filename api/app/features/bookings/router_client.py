"""Client routes: booking requests, the bookings list and detail, answers, cancel, venue, completion."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import (
    MailerDependency,
    PaymentGatewayDependency,
    PaymentGatewayError,
    PaymentsUnavailable,
)
from app.features.bookings import (
    errors,
    service_completion,
    service_create,
    service_payments_checkout,
    service_queries,
    service_status,
    service_venue,
)
from app.features.bookings.schemas import (
    BookingCheckoutResponse,
    BookingCheckoutSyncBody,
    BookingCheckoutSyncResponse,
    BookingRequestCreated,
    ClientBookingDetailResponse,
    ClientBookingsListResponse,
    ClientBookingStatusBody,
    ConfirmCompletionResponse,
    CreateBookingRequestBody,
    UpdateBookingVenueBody,
    VendorBookingStatusResponse,
)
from app.features.bookings.service_common import require_booking_id

router = APIRouter(prefix="/client", tags=["client"])

_GROUP_QUERY = Query("active", description="Filter bucket: active, completed, closed, or all")
_CANCEL_ERRORS = (
    errors.CancelCompleteInstead,
    errors.CancelAfterPayout,
    errors.CancelPartialRefund,
    errors.BookingAlreadyRefunded,
    errors.CancelOpenDispute,
    errors.RefundFailed,
)


@router.get(
    "/booking-requests",
    response_model=ClientBookingsListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidListGroup),
)
async def list_client_bookings(
    session: SessionDep,
    client: CurrentClient,
    group: str = _GROUP_QUERY,
    status: str | None = Query(None, description="Optional exact booking status, e.g. pending"),
    payment_status: str | None = Query(None, description="Optional exact payment_status"),
    exclude_payment_status: str | None = Query(
        None, description="Exclude this payment_status (e.g. unpaid for payment history)"
    ),
) -> ClientBookingsListResponse:
    """The client's bookings in one bucket, most recently active first."""
    bookings = await service_queries.client_bookings(
        session,
        client.id,
        group=group,
        status=status,
        payment_status=payment_status,
        exclude_payment_status=exclude_payment_status,
    )
    return ClientBookingsListResponse(bookings=bookings)


@router.get(
    "/booking-requests/{booking_id}",
    response_model=ClientBookingDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidBookingId, errors.BookingNotFound),
)
async def get_client_booking(
    session: SessionDep, client: CurrentClient, booking_id: str
) -> ClientBookingDetailResponse:
    """One booking with its price breakdown, the vendor's phone once paid, and the client's review."""
    booking = await service_queries.client_booking_detail(session, client.id, require_booking_id(booking_id))
    return ClientBookingDetailResponse(booking=booking)


@router.patch(
    "/booking-requests/{booking_id}/status",
    response_model=VendorBookingStatusResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.RespondOnlyPending,
        errors.NothingToRespondTo,
    ),
)
async def patch_client_booking_status(
    session: SessionDep,
    client: CurrentClient,
    booking_id: str,
    body: ClientBookingStatusBody,
    mailer: MailerDependency,
) -> VendorBookingStatusResponse:
    """Accept or decline a vendor's quote or updated price (declining a new price keeps the old one)."""
    return await service_status.answer_for_client(
        session,
        mailer,
        client.id,
        require_booking_id(booking_id),
        body.booking_status,
        event_postcode=body.event_postcode,
        event_address=body.event_address,
    )


@router.post(
    "/booking-requests/{booking_id}/cancel",
    response_model=VendorBookingStatusResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.CancelOnlyPendingOrAccepted,
        *_CANCEL_ERRORS,
    ),
)
async def post_cancel_client_booking(
    session: SessionDep,
    client: CurrentClient,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> VendorBookingStatusResponse:
    """Cancel a pending or accepted booking (a paid one is refunded in full first); the vendor is told."""
    return await service_status.cancel_for_client(
        session, mailer, gateway, client.id, require_booking_id(booking_id)
    )


@router.patch(
    "/booking-requests/{booking_id}/venue",
    response_model=ClientBookingDetailResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.VenueAcceptedOnly,
        errors.BookingAlreadyPaid,
    ),
)
async def patch_client_booking_venue(
    session: SessionDep, client: CurrentClient, booking_id: str, body: UpdateBookingVenueBody
) -> ClientBookingDetailResponse:
    """Set the venue of an accepted booking before paying."""
    booking = await service_venue.update_venue(session, client.id, require_booking_id(booking_id), body)
    return ClientBookingDetailResponse(booking=booking)


@router.post(
    "/booking-requests/{booking_id}/checkout",
    response_model=BookingCheckoutResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.CheckoutBookingNotFound,
        errors.OnlyAcceptedCanBePaid,
        errors.CheckoutAlreadyPaid,
        errors.VendorPayoutsNotReady,
        errors.CheckoutVendorUnavailable,
        errors.CheckoutMissingEventDate,
        errors.CheckoutPricesToConfirm,
        errors.NothingToPay,
        errors.EventAddressRequiredToPay,
        PaymentsUnavailable,
        PaymentGatewayError,
    ),
)
async def post_booking_checkout(
    session: SessionDep, client: CurrentClient, booking_id: str, gateway: PaymentGatewayDependency
) -> BookingCheckoutResponse:
    """Re-price the accepted booking and return the Stripe Checkout URL to pay it."""
    checkout_url = await service_payments_checkout.start_checkout(
        session, gateway, client_user_id=client.id, booking_id=require_booking_id(booking_id)
    )
    return BookingCheckoutResponse(checkout_url=checkout_url)


@router.post(
    "/booking-requests/{booking_id}/checkout/sync",
    response_model=BookingCheckoutSyncResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.CheckoutBookingNotFound,
        errors.BookingNoLongerPayable,
        errors.NoCheckoutSession,
        errors.PaymentLinkExpired,
        errors.CheckoutSessionMismatch,
        errors.CheckoutSessionAccountMismatch,
        errors.PaymentNotFinished,
        PaymentsUnavailable,
        PaymentGatewayError,
    ),
)
async def post_booking_checkout_sync(
    session: SessionDep,
    client: CurrentClient,
    booking_id: str,
    body: BookingCheckoutSyncBody,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> BookingCheckoutSyncResponse:
    """Confirm the payment after Stripe's redirect, in case the webhook has not arrived yet."""
    payment_status = await service_payments_checkout.sync_checkout(
        session,
        mailer,
        gateway,
        client_user_id=client.id,
        booking_id=require_booking_id(booking_id),
        session_id=body.session_id,
    )
    return BookingCheckoutSyncResponse(payment_status=payment_status)


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
async def post_client_confirm_completion(
    session: SessionDep,
    client: CurrentClient,
    booking_id: str,
    mailer: MailerDependency,
    gateway: PaymentGatewayDependency,
) -> ConfirmCompletionResponse:
    """Confirm the event went ahead; the vendor is paid once they confirm too."""
    return await service_completion.confirm_completion(
        session,
        mailer,
        gateway,
        party="client",
        user_id=client.id,
        booking_id=require_booking_id(booking_id),
    )


@router.post(
    "/booking-requests",
    response_model=BookingRequestCreated,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidVendorId,
        errors.CannotBookOwnVendor,
        errors.VendorNotBookable,
        errors.PartySuspended,
        errors.EventDatesUnavailable,
        errors.EventSpanTooLong,
        errors.VendorFullOnDate,
        errors.LineItemsInvalid,
        errors.NoValidPrice,
    ),
)
async def post_booking_request(
    session: SessionDep, client: CurrentClient, body: CreateBookingRequestBody, mailer: MailerDependency
) -> BookingRequestCreated:
    """Ask a vendor for some of their packages on a date; the vendor is told and the notes go to chat."""
    return await service_create.create_request(session, mailer, client, body)
