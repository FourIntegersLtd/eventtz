"""Client booking requests (approved vendors only)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_client
from app.core.logging import get_logger
from app.contracts.booking import (
    BookingRequestCreated,
    ClientBookingDetail,
    ClientBookingDetailResponse,
    ClientBookingListItem,
    ClientBookingStatusBody,
    ClientBookingsListResponse,
    CreateBookingRequestBody,
    UpdateBookingVenueBody,
    VendorBookingStatusResponse,
)
from app.features.bookings.http import disputes_http as dh
from app.contracts.disputes import (
    CreateParticipantDisputeBody,
    CreateParticipantDisputeResponse,
    ParticipantDisputeDetailResponse,
    ParticipantDisputesListResponse,
)
from app.contracts.payments import BookingCheckoutResponse, ConfirmCompletionResponse
from app.contracts.reviews import (
    ClientOwnerReviewItem,
    ClientOwnerReviewsResponse,
    PostBookingReviewBody,
    PostBookingReviewResponse,
)
from app.features.bookings.payments import (
    confirm_completion_for_client,
    create_checkout_session_for_booking,
)
from app.features.bookings import (
    cancel_booking_request_for_client,
    create_booking_request,
    get_booking_request_for_client,
    list_booking_requests_for_client,
    update_booking_request_status_for_client,
    update_booking_venue_for_client,
)
from app.features.bookings.reviews import create_booking_review, list_reviews_for_client

router = APIRouter(prefix="/client", tags=["client"])
logger = get_logger(__name__)


@router.get("/booking-requests", response_model=ClientBookingsListResponse)
def list_client_bookings(
    request: Request,
    response: Response,
    group: str = Query(
        "active",
        description="Filter bucket: active (pending+accepted), completed, or closed (declined+cancelled)",
    ),
) -> ClientBookingsListResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    g = group.strip().lower()
    if g not in ("active", "completed", "closed"):
        raise HTTPException(
            status_code=400,
            detail="Query parameter group must be active, completed, or closed.",
        )
    try:
        rows = list_booking_requests_for_client(client_id, group=g)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    bookings = [ClientBookingListItem(**r) for r in rows]
    return ClientBookingsListResponse(bookings=bookings)


@router.get("/booking-requests/{booking_id}", response_model=ClientBookingDetailResponse)
def get_client_booking(
    request: Request,
    response: Response,
    booking_id: str,
) -> ClientBookingDetailResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    row = get_booking_request_for_client(client_id, booking_id)
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")

    return ClientBookingDetailResponse(booking=ClientBookingDetail(**row))


@router.post(
    "/booking-requests/{booking_id}/disputes",
    response_model=CreateParticipantDisputeResponse,
)
def post_client_booking_dispute(
    request: Request,
    response: Response,
    booking_id: str,
    body: CreateParticipantDisputeBody,
) -> CreateParticipantDisputeResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    return dh.create_booking_dispute(booking_id, uid, body)


@router.get(
    "/booking-requests/{booking_id}/disputes",
    response_model=ParticipantDisputesListResponse,
)
def list_client_booking_disputes(
    request: Request,
    response: Response,
    booking_id: str,
) -> ParticipantDisputesListResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e
    return dh.list_booking_disputes(booking_id, uid)


@router.get("/disputes", response_model=ParticipantDisputesListResponse)
def list_client_disputes(request: Request, response: Response) -> ParticipantDisputesListResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return dh.list_user_disputes(uid)


@router.get("/disputes/{dispute_id}", response_model=ParticipantDisputeDetailResponse)
def get_client_dispute(
    request: Request,
    response: Response,
    dispute_id: str,
) -> ParticipantDisputeDetailResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return dh.get_dispute(dispute_id, uid)


@router.get("/reviews", response_model=ClientOwnerReviewsResponse)
def get_client_own_reviews(request: Request, response: Response) -> ClientOwnerReviewsResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    rows, summary = list_reviews_for_client(uid, limit=100)
    items = [ClientOwnerReviewItem.model_validate(r) for r in rows]
    return ClientOwnerReviewsResponse(
        success=True,
        reviews=items,
        review_count=int(summary.get("review_count") or 0),
    )


@router.post("/booking-requests/{booking_id}/review", response_model=PostBookingReviewResponse)
def post_booking_review(
    request: Request,
    response: Response,
    booking_id: str,
    body: PostBookingReviewBody,
) -> PostBookingReviewResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    try:
        rev = create_booking_review(
            client_user_id=client_id,
            booking_id=booking_id,
            rating=body.rating,
            body=body.body,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return PostBookingReviewResponse(review=rev)


@router.patch(
    "/booking-requests/{booking_id}/status",
    response_model=VendorBookingStatusResponse,
)
def patch_client_booking_status(
    request: Request,
    response: Response,
    booking_id: str,
    body: ClientBookingStatusBody,
) -> VendorBookingStatusResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    try:
        row = update_booking_request_status_for_client(
            client_id,
            booking_id,
            new_status=body.status,
            event_postcode=body.event_postcode,
            event_address=body.event_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")

    return VendorBookingStatusResponse(
        id=str(row["id"]),
        status=str(row["status"]),
    )


@router.post("/booking-requests/{booking_id}/cancel", response_model=VendorBookingStatusResponse)
def post_cancel_client_booking(
    request: Request,
    response: Response,
    booking_id: str,
) -> VendorBookingStatusResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    try:
        row = cancel_booking_request_for_client(client_id, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")

    return VendorBookingStatusResponse(
        id=str(row["id"]),
        status=str(row["status"]),
    )


@router.patch(
    "/booking-requests/{booking_id}/venue",
    response_model=ClientBookingDetailResponse,
)
def patch_client_booking_venue(
    request: Request,
    response: Response,
    booking_id: str,
    body: UpdateBookingVenueBody,
) -> ClientBookingDetailResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e
    try:
        row = update_booking_venue_for_client(
            client_id,
            booking_id,
            event_postcode=body.event_postcode,
            event_address=body.event_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return ClientBookingDetailResponse(booking=ClientBookingDetail(**row))


@router.post(
    "/booking-requests/{booking_id}/checkout",
    response_model=BookingCheckoutResponse,
)
def post_booking_checkout(
    request: Request,
    response: Response,
    booking_id: str,
) -> BookingCheckoutResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    try:
        checkout_url = create_checkout_session_for_booking(client_id, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("checkout session creation failed booking=%s client=%s", booking_id, client_id)
        raise HTTPException(
            status_code=500,
            detail="Could not start checkout. Try again shortly.",
        ) from None

    return BookingCheckoutResponse(checkout_url=checkout_url)


@router.post(
    "/booking-requests/{booking_id}/confirm-completion",
    response_model=ConfirmCompletionResponse,
)
def post_client_confirm_completion(
    request: Request,
    response: Response,
    booking_id: str,
) -> ConfirmCompletionResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid booking id.") from e

    try:
        result = confirm_completion_for_client(client_id, booking_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not result:
        raise HTTPException(status_code=404, detail="Booking not found.")

    return ConfirmCompletionResponse(**result)


@router.post("/booking-requests", response_model=BookingRequestCreated)
def post_booking_request(
    request: Request,
    response: Response,
    body: CreateBookingRequestBody,
) -> BookingRequestCreated:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    vendor_id = body.vendor_user_id.strip()
    try:
        uuid.UUID(vendor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid vendor id.") from e

    try:
        out = create_booking_request(
            client_user_id=client_id,
            vendor_user_id=vendor_id,
            event_name=body.event_name,
            event_date=body.event_date,
            event_end_date=body.event_end_date,
            event_postcode=body.event_postcode,
            event_address=body.event_address,
            notes=body.notes,
            selected_option_ids=body.selected_option_ids,
            line_items=[li.model_dump() for li in body.line_items],
            total_label=body.total_label,
        )
    except ValueError as e:
        logger.info("booking_request rejected: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("booking_request insert failed client=%s vendor=%s", client_id, vendor_id)
        raise HTTPException(
            status_code=500,
            detail="Could not save your booking request. Try again later.",
        ) from None

    created_at = out.get("created_at")
    return BookingRequestCreated(
        id=str(out["id"]),
        status="pending",
        created_at=created_at if isinstance(created_at, str) else None,
    )
