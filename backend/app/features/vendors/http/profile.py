"""Persist vendor profile (vendors table — JSON payload; files via Storage later)."""

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_user
from app.core.logging import get_logger
from app.contracts.vendor import VendorProfilePutBody, VendorProfileState
from app.features.vendors.profile import get_vendor_profile, upsert_vendor_profile

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
