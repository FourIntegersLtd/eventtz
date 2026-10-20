"""Request and response bodies for the vendor onboarding AI helpers (bio, photo QA, packages).

New file: the existing `vendors/schemas.py` is left untouched. Names and fields match the
baseline contracts (`backend/app/contracts/vendor_onboarding_ai.py`), so the generated web
types do not change.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GenerateVendorBioBody(BaseModel):
    """Profile details sent to the AI; private fields are stripped before the model sees them."""

    profile_form_data: dict[str, Any] = Field(default_factory=dict)


class GenerateVendorBioResponse(BaseModel):
    """The AI-written public bio."""

    bio: str


class AnalyzePortfolioImageResponse(BaseModel):
    """The AI's quick QA of one portfolio photo upload."""

    ok: bool
    score: int = Field(ge=1, le=5)
    summary: str


class AnalyzePortfolioImageUrlBody(BaseModel):
    """Public URL of a photo already uploaded to our S3 bucket (presigned flow)."""

    image_url: str = Field(min_length=1)


class PackageCoachTip(BaseModel):
    """One suggestion or warning about a package, in the legacy flat shape some screens still read."""

    severity: str = Field(description="tip or suggestion")
    package_id: str | None = None
    package_title: str | None = None
    code: str
    message: str


class PackageCoachPackageFeedback(BaseModel):
    """The AI's feedback on one package, with suggested rewrites where it has better copy."""

    package_id: str | None = None
    package_title: str
    items: list[str] = Field(default_factory=list)
    suggested_title: str | None = None
    suggested_details: str | None = None
    suggested_duration: str | None = None


class ReviewVendorPackagesBody(BaseModel):
    """Profile details (including packages) sent to the AI package coach."""

    profile_form_data: dict[str, Any] = Field(default_factory=dict)


class ReviewVendorPackagesResponse(BaseModel):
    """The AI package coach's review: a summary, per-package feedback, and the legacy flat tips."""

    overall_ok: bool = True
    summary: str = ""
    package_feedback: list[PackageCoachPackageFeedback] = Field(default_factory=list)
    tips: list[PackageCoachTip] = Field(default_factory=list)
