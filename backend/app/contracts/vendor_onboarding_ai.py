"""Shared types for AI help during vendor signup (bio writing and photo checks)."""

from typing import Any

from pydantic import BaseModel, Field


class GenerateVendorBioBody(BaseModel):
    """Profile details sent to the AI; we remove private fields before calling it."""

    payload: dict[str, Any] = Field(default_factory=dict)


class GenerateVendorBioResponse(BaseModel):
    bio: str


class AnalyzePortfolioImageResponse(BaseModel):
    ok: bool
    score: int = Field(ge=1, le=5)
    summary: str


class PackageCoachTip(BaseModel):
    severity: str = Field(description="tip or suggestion")
    package_id: str | None = None
    package_title: str | None = None
    code: str
    message: str


class PackageCoachPackageFeedback(BaseModel):
    package_id: str | None = None
    package_title: str
    items: list[str] = Field(default_factory=list)
    suggested_title: str | None = None
    suggested_details: str | None = None
    suggested_duration: str | None = None


class ReviewVendorPackagesBody(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class ReviewVendorPackagesResponse(BaseModel):
    overall_ok: bool = True
    summary: str = ""
    package_feedback: list[PackageCoachPackageFeedback] = Field(default_factory=list)
    tips: list[PackageCoachTip] = Field(default_factory=list)
