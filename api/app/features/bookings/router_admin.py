"""Staff routes: the admin bookings console and the financials screen.

List and detail are for any staff member; the payment-fields patch, checkout
reset, support hold and the financials CSV export are super-admin only,
mirroring the baseline's `require_admin()`/`require_super_admin()` split.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Response

from app.core.auth import ROLE_ERRORS, CurrentStaff, CurrentSuperAdmin
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import PageDep
from app.core.ports import PaymentGatewayDependency
from app.features.bookings import service_admin, service_admin_financials
from app.features.bookings.errors import (
    AdminBookingNotFound,
    CouldNotUpdatePaymentFields,
    NoPaymentFieldsToUpdate,
    OnlyUnpaidOrPendingCanBeReset,
    StripeChargeMismatch,
    StripeChargeUnverified,
    StripePaymentIntentNoConfirmedAmount,
    StripePaymentIntentRequiredForAmount,
    StripeVerificationFailed,
)
from app.features.bookings.service_admin import (
    AdminBookingDetailResponse,
    AdminBookingsListResponse,
    AdminPaymentFieldsPatchBody,
    AdminPaymentFieldsPatchResponse,
    AdminSupportHoldBody,
)
from app.features.bookings.service_admin_financials import (
    CSV_CONTENT_TYPE,
    CSV_FILENAME,
    AdminFinancialsDailyListResponse,
    AdminFinancialsSummary,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/bookings",
    response_model=AdminBookingsListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_bookings(
    session: SessionDep,
    staff: CurrentStaff,
    page: PageDep,
    status: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    search: str | None = Query(None),
) -> AdminBookingsListResponse:
    """A page of every booking on the platform, with each row's support summary."""
    bookings, total = await service_admin.list_bookings(
        session,
        offset=page.offset,
        limit=page.limit,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    return AdminBookingsListResponse(bookings=bookings, total=total, offset=page.offset, limit=page.limit)


@router.get(
    "/bookings/{booking_id}",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*ROLE_ERRORS, AdminBookingNotFound),
)
async def get_booking(
    session: SessionDep, staff: CurrentStaff, booking_id: str
) -> AdminBookingDetailResponse:
    """One booking, admin-eyes view: every column plus resolved party details and diagnostics."""
    detail = await service_admin.get_booking_detail(session, staff, booking_id)
    return AdminBookingDetailResponse(booking=detail)


@router.patch(
    "/bookings/{booking_id}/payment-fields",
    response_model=AdminPaymentFieldsPatchResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        AdminBookingNotFound,
        NoPaymentFieldsToUpdate,
        StripePaymentIntentRequiredForAmount,
        StripeVerificationFailed,
        StripePaymentIntentNoConfirmedAmount,
        StripeChargeUnverified,
        StripeChargeMismatch,
        CouldNotUpdatePaymentFields,
    ),
)
async def patch_booking_payment_fields(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    payment_gateway: PaymentGatewayDependency,
    booking_id: str,
    body: AdminPaymentFieldsPatchBody,
) -> AdminPaymentFieldsPatchResponse:
    """Write staff-verified Stripe ids and amount onto a booking, after checking them with Stripe."""
    await service_admin.patch_payment_fields(
        session, staff, payment_gateway, booking_id, body.model_dump(exclude_unset=True)
    )
    return AdminPaymentFieldsPatchResponse()


@router.post(
    "/bookings/{booking_id}/reset-checkout",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*ROLE_ERRORS, AdminBookingNotFound, OnlyUnpaidOrPendingCanBeReset),
)
async def reset_booking_checkout(
    session: SessionDep, staff: CurrentSuperAdmin, booking_id: str
) -> AdminBookingDetailResponse:
    """Clear a stale Stripe Checkout session and return the booking to unpaid."""
    detail = await service_admin.reset_checkout(session, staff, booking_id)
    return AdminBookingDetailResponse(booking=detail)


@router.patch(
    "/bookings/{booking_id}/support-hold",
    response_model=AdminBookingDetailResponse,
    responses=error_responses(*ROLE_ERRORS, AdminBookingNotFound),
)
async def set_booking_support_hold(
    session: SessionDep, staff: CurrentSuperAdmin, booking_id: str, body: AdminSupportHoldBody
) -> AdminBookingDetailResponse:
    """Pause or resume a booking's automatic payout release."""
    detail = await service_admin.set_support_hold(session, staff, booking_id, hold=body.hold)
    return AdminBookingDetailResponse(booking=detail)


@router.get(
    "/financials/summary",
    response_model=AdminFinancialsSummary,
    responses=error_responses(*ROLE_ERRORS),
)
async def financials_summary(
    session: SessionDep,
    staff: CurrentStaff,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
) -> AdminFinancialsSummary:
    """Totals for the admin financials screen, over an optional `paid_at` date range."""
    return await service_admin_financials.financials_summary(session, date_from=date_from, date_to=date_to)


@router.get(
    "/financials/daily",
    response_model=AdminFinancialsDailyListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def financials_daily(
    session: SessionDep,
    staff: CurrentStaff,
    page: PageDep,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
) -> AdminFinancialsDailyListResponse:
    """One page of daily financial buckets for the admin table."""
    return await service_admin_financials.financials_daily_page(
        session, date_from=date_from, date_to=date_to, offset=page.offset, limit=page.limit
    )


@router.get(
    "/financials/export.csv",
    response_class=Response,
    responses=error_responses(*ROLE_ERRORS),
)
async def financials_export_csv(
    session: SessionDep,
    staff: CurrentSuperAdmin,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
) -> Response:
    """The financials CSV attachment; writes a `financials.export_csv` audit row."""
    body = await service_admin_financials.financials_export_csv(
        session, staff, date_from=date_from, date_to=date_to
    )
    return Response(
        content=body,
        media_type=CSV_CONTENT_TYPE,
        headers={"Content-Disposition": CSV_FILENAME},
    )
