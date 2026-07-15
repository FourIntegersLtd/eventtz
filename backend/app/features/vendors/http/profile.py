"""HTTP routes to load and save the vendor profile (JSON in the database; files via Storage later)."""

from fastapi import APIRouter, Query, Request, Response

from app.features.auth.http.guards import require_user, require_vendor
from app.core.logging import get_logger
from app.contracts.vendor import (
    VendorBusinessNameAvailabilityResponse,
    VendorProfilePutBody,
    VendorProfileState,
)
from app.contracts.reviews import VendorOwnerReviewItem, VendorOwnerReviewsResponse
from app.features.vendors.profile import get_vendor_profile, upsert_vendor_profile
from app.features.vendors.business_name import is_business_name_available
from app.features.bookings.reviews import list_reviews_for_vendor_owner

router = APIRouter(prefix="/vendor", tags=["vendor"])
logger = get_logger(__name__)


@router.get("/profile", response_model=VendorProfileState)
def get_vendor_profile_state(request: Request, response: Response) -> VendorProfileState:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    logger.info(
        "GET /vendor/profile auth_user_id=%s merged_user_type=%s",
        uid,
        user.get("user_type"),
    )
    row = get_vendor_profile(uid)
    if row:
        logger.info(
            "GET /vendor/profile found row user_id=%s status=%s approval_status=%s current_step=%s",
            uid,
            row.get("status"),
            row.get("approval_status"),
            row.get("current_step"),
        )
    else:
        logger.info("GET /vendor/profile no row for user_id=%s", uid)
    if not row:
        return VendorProfileState(current_step=1, status="draft", approval_status="pending", payload={})
    return VendorProfileState(
        success=True,
        current_step=row.get("current_step", 1),
        status=row.get("status", "draft"),
        approval_status=row.get("approval_status", "pending"),
        payload=row.get("payload") or {},
        updated_at=row.get("updated_at"),
    )


@router.get("/profile/business-name-available", response_model=VendorBusinessNameAvailabilityResponse)
def get_business_name_available(
    request: Request,
    response: Response,
    business_name: str = Query(..., min_length=1, max_length=200),
) -> VendorBusinessNameAvailabilityResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    available = is_business_name_available(business_name, exclude_user_id=uid)
    return VendorBusinessNameAvailabilityResponse(success=True, available=available)


@router.put("/profile", response_model=VendorProfileState)
def put_vendor_profile_state(
    request: Request,
    response: Response,
    body: VendorProfilePutBody,
) -> VendorProfileState:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    logger.info(
        "PUT /vendor/profile auth_user_id=%s merged_user_type=%s body_step=%s body_status=%s",
        uid,
        user.get("user_type"),
        body.current_step,
        body.status,
    )
    row = upsert_vendor_profile(
        uid,
        current_step=body.current_step,
        payload=body.payload,
        status=body.status,
        user_email=str(user.get("email") or "") or None,
    )
    logger.info(
        "PUT /vendor/profile saved user_id=%s status=%s approval_status=%s current_step=%s",
        uid,
        row.get("status"),
        row.get("approval_status"),
        row.get("current_step"),
    )
    return VendorProfileState(
        success=True,
        current_step=row.get("current_step", 1),
        status=row.get("status", "draft"),
        approval_status=row.get("approval_status", "pending"),
        payload=row.get("payload") or {},
        updated_at=row.get("updated_at"),
    )


@router.get("/reviews", response_model=VendorOwnerReviewsResponse)
def get_vendor_own_reviews(request: Request, response: Response) -> VendorOwnerReviewsResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    rows, summary = list_reviews_for_vendor_owner(uid, limit=100)
    items = [VendorOwnerReviewItem.model_validate(r) for r in rows]
    return VendorOwnerReviewsResponse(
        success=True,
        reviews=items,
        average_rating=summary.get("average_rating"),
        review_count=int(summary.get("review_count") or 0),
    )
