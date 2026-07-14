"""Shared vendor response/request schemas."""

from typing import Any

from pydantic import BaseModel, Field

from app.contracts.types import VendorApprovalStatus, VendorProfileStatus


class VendorProfilePutBody(BaseModel):
    current_step: int = Field(ge=1, le=20)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: VendorProfileStatus | None = Field(
        default=None,
        description="draft | submitted | complete",
    )


class VendorProfileState(BaseModel):
    success: bool = True
    current_step: int
    status: VendorProfileStatus | str
    approval_status: VendorApprovalStatus | str = "pending"
    payload: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None


class VendorBusinessNameAvailabilityResponse(BaseModel):
    success: bool = True
    available: bool


class AdminVendorRow(BaseModel):
    id: str | None = None
    user_id: str
    email: str | None = None
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str = "pending"
    current_step: int = 1
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class AdminVendorsListResponse(BaseModel):
    success: bool = True
    vendors: list[AdminVendorRow] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = 50


class AdminVendorApprovalResponse(BaseModel):
    success: bool = True
    user_id: str
    approval_status: VendorApprovalStatus | str


class ExploreVendorRow(BaseModel):
    user_id: str
    email: str | None = None
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str
    payload: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None
    review_average: float | None = None
    review_count: int = 0


class ExploreVendorsResponse(BaseModel):
    success: bool = True
    vendors: list[ExploreVendorRow] = Field(default_factory=list)


class ExploreVendorSingleResponse(BaseModel):
    success: bool = True
    vendor: ExploreVendorRow


class ExploreVendorSearchRow(ExploreVendorRow):
    """Explore row with which service tags matched the current search."""

    matched_services: list[str] = Field(default_factory=list)
    match_tier: str = Field(
        default="exact",
        description="exact | related | fallback — ranking tier for close-enough search",
    )


class ExploreVendorSearchResponse(BaseModel):
    success: bool = True
    total_count: int = 0
    vendors: list[ExploreVendorSearchRow] = Field(default_factory=list)
    match_notice: str | None = None
    has_exact: bool = False
    has_related: bool = False


class AdminVendorApprovalBody(BaseModel):
    approval_status: VendorApprovalStatus = Field(
        description=(
            "pending = awaiting review; approved = visible on client explore; "
            "banned = hidden from client explore."
        ),
    )
