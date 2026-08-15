"""Referral partner contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.contracts.types import VendorApprovalStatus, VendorProfileStatus

ShoutoutFilter = Literal["all", "pending", "completed"]


class ReferralPartnerRow(BaseModel):
    id: str
    slug: str
    display_name: str
    instagram_handle: str | None = None
    notes: str | None = None
    is_active: bool = True
    referral_link: str
    created_at: str | None = None
    updated_at: str | None = None


class ReferralPartnerListResponse(BaseModel):
    success: bool = True
    partners: list[ReferralPartnerRow]


class CreateReferralPartnerRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    instagram_handle: str | None = Field(default=None, max_length=80)
    slug: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class UpdateReferralPartnerRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    instagram_handle: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class ReferralPartnerResponse(BaseModel):
    success: bool = True
    partner: ReferralPartnerRow


class ReferralPartnerPublicResponse(BaseModel):
    success: bool = True
    slug: str
    display_name: str


class ReferralVendorSignupRow(BaseModel):
    user_id: str
    email: str | None = None
    business_name: str | None = None
    approval_status: VendorApprovalStatus | str | None = None
    onboarding_status: VendorProfileStatus | str | None = Field(
        default=None,
        validation_alias=AliasChoices("profile_status", "status"),
    )
    attributed_at: str | None = None
    shoutout_completed: bool = False
    shoutout_completed_at: str | None = None
    explore_path: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class ReferralSignupListResponse(BaseModel):
    success: bool = True
    partner: ReferralPartnerRow
    signups: list[ReferralVendorSignupRow]
    total: int
    offset: int
    limit: int


class UpdateReferralShoutoutRequest(BaseModel):
    shoutout_completed: bool
