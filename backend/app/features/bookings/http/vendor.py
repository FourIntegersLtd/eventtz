"""Vendor: view booking requests from clients."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_vendor
from app.core.logging import get_logger
from app.contracts.booking import (
    BookingRequestCreated,
    CreateVendorQuoteBody,
    PutVendorBookingAdjustmentsBody,
    PutVendorBookingAdjustmentsResponse,
    VendorBookingDetail,
    VendorBookingDetailResponse,
    VendorBookingListItem,
    VendorBookingStatusBody,
    VendorBookingStatusResponse,
    VendorBookingsListResponse,
)
from app.features.bookings import messages as booking_messages
from app.features.bookings.http import participant_dispute_handlers as dh
from app.contracts.disputes import (
    CreateParticipantDisputeBody,
    CreateParticipantDisputeResponse,
    ParticipantDisputeDetailResponse,
    ParticipantDisputesListResponse,
)
from app.contracts.payments import ConfirmCompletionResponse
from app.contracts.receipts import PaymentReceiptResponse
from app.features.bookings.payments import (
    confirm_completion_for_vendor,
    maybe_auto_release_payout_for_booking,
    touch_completion_side_effects_for_booking_rows,
)
from app.features.bookings import (
    create_vendor_quote_booking_request,
    get_booking_request_for_vendor,
    list_booking_requests_for_vendor,
    put_vendor_booking_adjustments,
    update_booking_request_status_for_vendor,
)
from app.features.bookings.receipts import (
    build_vendor_payment_record,
    build_vendor_payout_statement,
    load_payment_snapshot,
)
from app.features.bookings.receipt_document import payment_receipt_response, receipt_html_response

router = APIRouter(prefix="/vendor", tags=["vendor"])
logger = get_logger(__name__)


@router.post("/booking-requests/vendor-quote", response_model=BookingRequestCreated)
def post_vendor_quote(
    request: Request,
    response: Response,
    body: CreateVendorQuoteBody,
) -> BookingRequestCreated:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    client_id = body.client_user_id.strip()
    try:
        uuid.UUID(client_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_CLIENT_ID) from e
    if body.conversation_id:
        try:
            uuid.UUID(body.conversation_id.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=booking_messages.INVALID_CONVERSATION_ID) from e

    try:
        out = create_vendor_quote_booking_request(
            vendor_user_id=vendor_id,
            client_user_id=client_id,
            conversation_id=body.conversation_id.strip() if body.conversation_id else None,
            event_name=body.event_name,
            event_date=body.event_date,
            event_end_date=body.event_end_date,
            notes=body.notes,
            line_items=[li.model_dump() for li in body.line_items],
        )
    except ValueError as e:
        logger.info("vendor_quote rejected: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("vendor_quote insert failed vendor=%s client=%s", vendor_id, client_id)
        raise HTTPException(
            status_code=500,
            detail=booking_messages.COULD_NOT_SAVE_QUOTE,
        ) from None

    created_at = out.get("created_at")
    return BookingRequestCreated(
        id=str(out["id"]),
        status="pending",
        created_at=created_at if isinstance(created_at, str) else None,
    )


@router.get("/booking-requests", response_model=VendorBookingsListResponse)
def list_vendor_bookings(
    request: Request,
    response: Response,
    group: str = Query(
        "active",
        description="Filter bucket: active, completed, closed, or all",
    ),
    status: str | None = Query(None, description="Optional exact booking status, e.g. pending"),
    payment_status: str | None = Query(None, description="Optional exact payment_status"),
    exclude_payment_status: str | None = Query(None, description="Exclude this payment_status"),
) -> VendorBookingsListResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    g = group.strip().lower()
    if g not in ("active", "completed", "closed", "all"):
        raise HTTPException(
            status_code=400,
            detail=booking_messages.GROUP_QUERY_PARAM,
        )
    try:
        rows = list_booking_requests_for_vendor(
            vendor_id,
            group=g,
            status=status,
            payment_status=payment_status,
            exclude_payment_status=exclude_payment_status,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if g == "active":
        touch_completion_side_effects_for_booking_rows(rows)
    bookings = [VendorBookingListItem(**r) for r in rows]
    return VendorBookingsListResponse(bookings=bookings)


@router.put(
    "/booking-requests/{booking_id}/adjustments",
    response_model=PutVendorBookingAdjustmentsResponse,
)
def put_vendor_booking_adjustments_ep(
    request: Request,
    response: Response,
    booking_id: str,
    body: PutVendorBookingAdjustmentsBody,
) -> PutVendorBookingAdjustmentsResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    payload = [a.model_dump() for a in body.adjustments]
    try:
        row = put_vendor_booking_adjustments(vendor_id, booking_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return PutVendorBookingAdjustmentsResponse(booking=VendorBookingDetail(**row))


@router.patch(
    "/booking-requests/{booking_id}/status",
    response_model=VendorBookingStatusResponse,
)
def patch_vendor_booking_status(
    request: Request,
    response: Response,
    booking_id: str,
    body: VendorBookingStatusBody,
) -> VendorBookingStatusResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    try:
        row = update_booking_request_status_for_vendor(
            vendor_id,
            booking_id,
            new_status=body.booking_status,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return VendorBookingStatusResponse(
        id=str(row["id"]),
        status=str(row["status"]),
    )


@router.post(
    "/booking-requests/{booking_id}/confirm-completion",
    response_model=ConfirmCompletionResponse,
)
def post_vendor_confirm_completion(
    request: Request,
    response: Response,
    booking_id: str,
) -> ConfirmCompletionResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    try:
        result = confirm_completion_for_vendor(vendor_id, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not result:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return ConfirmCompletionResponse(**result)


@router.get("/booking-requests/{booking_id}", response_model=VendorBookingDetailResponse)
def get_vendor_booking(
    request: Request,
    response: Response,
    booking_id: str,
) -> VendorBookingDetailResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    # Safety net between hourly runs: pay the vendor if the automatic payout date has passed.
    maybe_auto_release_payout_for_booking(booking_id)
    row = get_booking_request_for_vendor(vendor_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    return VendorBookingDetailResponse(booking=VendorBookingDetail(**row))


@router.get(
    "/booking-requests/{booking_id}/payment-record",
    response_model=PaymentReceiptResponse,
)
def get_vendor_booking_payment_record(
    request: Request,
    response: Response,
    booking_id: str,
) -> PaymentReceiptResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    row = get_booking_request_for_vendor(vendor_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    snap = load_payment_snapshot(booking_id)
    try:
        payload = build_vendor_payment_record(
            row,
            client_display_name=str(row.get("client_display_name") or "Client"),
            snapshot=snap,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return payment_receipt_response(payload)


@router.get("/booking-requests/{booking_id}/payment-record.html")
def get_vendor_booking_payment_record_html(
    request: Request,
    response: Response,
    booking_id: str,
) -> Response:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    row = get_booking_request_for_vendor(vendor_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    snap = load_payment_snapshot(booking_id)
    try:
        payload = build_vendor_payment_record(
            row,
            client_display_name=str(row.get("client_display_name") or "Client"),
            snapshot=snap,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return receipt_html_response(
        payload,
        filename=f"payment-record-{payload['receipt_number']}.html",
        inline=False,
    )


@router.get(
    "/booking-requests/{booking_id}/payout-statement",
    response_model=PaymentReceiptResponse,
)
def get_vendor_booking_payout_statement(
    request: Request,
    response: Response,
    booking_id: str,
) -> PaymentReceiptResponse:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    row = get_booking_request_for_vendor(vendor_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    snap = load_payment_snapshot(booking_id)
    try:
        payload = build_vendor_payout_statement(
            row,
            client_display_name=str(row.get("client_display_name") or "Client"),
            snapshot=snap,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return payment_receipt_response(payload)


@router.get("/booking-requests/{booking_id}/payout-statement.html")
def get_vendor_booking_payout_statement_html(
    request: Request,
    response: Response,
    booking_id: str,
) -> Response:
    user = require_vendor(request, response)
    vendor_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    row = get_booking_request_for_vendor(vendor_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail=booking_messages.BOOKING_NOT_FOUND)

    snap = load_payment_snapshot(booking_id)
    try:
        payload = build_vendor_payout_statement(
            row,
            client_display_name=str(row.get("client_display_name") or "Client"),
            snapshot=snap,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return receipt_html_response(
        payload,
        filename=f"payout-statement-{payload['receipt_number']}.html",
        inline=False,
    )


@router.post(
    "/booking-requests/{booking_id}/disputes",
    response_model=CreateParticipantDisputeResponse,
)
def post_vendor_booking_dispute(
    request: Request,
    response: Response,
    booking_id: str,
    body: CreateParticipantDisputeBody,
) -> CreateParticipantDisputeResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e

    return dh.create_booking_dispute(booking_id, uid, body)


@router.get(
    "/booking-requests/{booking_id}/disputes",
    response_model=ParticipantDisputesListResponse,
)
def list_vendor_booking_disputes(
    request: Request,
    response: Response,
    booking_id: str,
) -> ParticipantDisputesListResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=booking_messages.INVALID_BOOKING_ID) from e
    return dh.list_booking_disputes(booking_id, uid)


@router.get("/disputes", response_model=ParticipantDisputesListResponse)
def list_vendor_disputes(request: Request, response: Response) -> ParticipantDisputesListResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return dh.list_user_disputes(uid)


@router.get("/disputes/{dispute_id}", response_model=ParticipantDisputeDetailResponse)
def get_vendor_dispute(
    request: Request,
    response: Response,
    dispute_id: str,
) -> ParticipantDisputeDetailResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    return dh.get_dispute(dispute_id, uid)
