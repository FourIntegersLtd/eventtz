"""Vendor onboarding AI routes: write a bio, QA a portfolio photo, coach on packages.

New file: mounted alongside `vendors/router.py` (see `app.main._routers()`), it only ever
reaches its slice through `service_ai` (schemas, errors and use cases all live there — see
that module's docstring for why).
"""

from __future__ import annotations

from fastapi import APIRouter, UploadFile

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.errors import error_responses
from app.core.ports import (
    LanguageModelDependency,
    LanguageModelEmptyReply,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelUnavailable,
)
from app.features.vendors import service_ai

router = APIRouter(prefix="/vendor/onboarding/ai", tags=["vendor-onboarding-ai"])

# Every route here can also fail at the language model, the same way for all three.
_AI_ERRORS = (
    *ROLE_ERRORS,
    LanguageModelUnavailable,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelEmptyReply,
)


@router.post(
    "/generate-bio",
    response_model=service_ai.GenerateVendorBioResponse,
    responses=error_responses(*_AI_ERRORS),
)
async def generate_bio(
    principal: CurrentVendor,
    body: service_ai.GenerateVendorBioBody,
    language_model: LanguageModelDependency,
) -> service_ai.GenerateVendorBioResponse:
    """Write a public bio from the vendor's onboarding form so far."""
    del principal  # the bio is written from the submitted form data only, not stored profile state
    return await service_ai.generate_vendor_public_bio(
        payload=body.profile_form_data, language_model=language_model
    )


@router.post(
    "/analyze-portfolio-image",
    response_model=service_ai.AnalyzePortfolioImageResponse,
    responses=error_responses(
        *ROLE_ERRORS, service_ai.ImageRequired, service_ai.ImageContentTypeInvalid, *_AI_ERRORS
    ),
)
async def analyze_portfolio_image(
    principal: CurrentVendor,
    language_model: LanguageModelDependency,
    file: UploadFile,
) -> service_ai.AnalyzePortfolioImageResponse:
    """QA one portfolio photo before the vendor adds it to their listing."""
    del principal  # the photo itself carries everything this call needs
    image_bytes = await file.read()
    content_type = (file.content_type or "application/octet-stream").strip().lower()
    return await service_ai.analyze_portfolio_image(
        image_bytes=image_bytes, content_type=content_type, language_model=language_model
    )


@router.post(
    "/review-packages",
    response_model=service_ai.ReviewVendorPackagesResponse,
    responses=error_responses(*_AI_ERRORS),
)
async def review_packages(
    principal: CurrentVendor,
    body: service_ai.ReviewVendorPackagesBody,
    language_model: LanguageModelDependency,
) -> service_ai.ReviewVendorPackagesResponse:
    """Coach the vendor on their draft packages before they submit their profile."""
    del principal  # packages are reviewed from the submitted form data only, not stored profile state
    return await service_ai.review_vendor_packages(
        payload=body.profile_form_data, language_model=language_model
    )
