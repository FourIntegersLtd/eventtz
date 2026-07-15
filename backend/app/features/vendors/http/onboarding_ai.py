"""HTTP routes for AI-assisted vendor onboarding (bio and portfolio image checks)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, UploadFile

from app.features.auth.http.dependencies import require_vendor_dep
from app.contracts.vendor_onboarding_ai import (
    AnalyzePortfolioImageResponse,
    GenerateVendorBioBody,
    GenerateVendorBioResponse,
)
from app.features.vendors.onboarding_ai import (
    analyze_portfolio_image,
    generate_vendor_public_bio,
)

router = APIRouter(prefix="/vendor/onboarding/ai", tags=["vendor-onboarding-ai"])


@router.post("/generate-bio", response_model=GenerateVendorBioResponse)
def post_generate_vendor_bio(
    body: GenerateVendorBioBody,
    _vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> GenerateVendorBioResponse:
    bio = generate_vendor_public_bio(payload=dict(body.payload or {}))
    return GenerateVendorBioResponse(bio=bio)


@router.post("/analyze-portfolio-image", response_model=AnalyzePortfolioImageResponse)
async def post_analyze_portfolio_image(
    file: UploadFile,
    _vendor: Annotated[dict[str, Any], Depends(require_vendor_dep)],
) -> AnalyzePortfolioImageResponse:
    raw = await file.read()
    ct = (file.content_type or "application/octet-stream").strip().lower()
    ok, score, summary = analyze_portfolio_image(image_bytes=raw, content_type=ct)
    return AnalyzePortfolioImageResponse(ok=ok, score=score, summary=summary)
