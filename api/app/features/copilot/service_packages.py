"""The post-launch package coach: the same engine as onboarding's, reused for live vendors.

Delegates the actual model call to `vendors.service_ai.review_vendor_packages` (a cross-slice
`service*` import, not that slice's domain or repository) — with no OpenAI key configured this
raises `LanguageModelUnavailable` (503) unchanged, exactly like the onboarding version.
"""

from __future__ import annotations

from app.core.ports import LanguageModel
from app.features.copilot.schemas import CopilotReviewPackagesResponse
from app.features.vendors.service_ai import review_vendor_packages


async def review_listing_packages(
    *, payload: dict[str, object], language_model: LanguageModel
) -> CopilotReviewPackagesResponse:
    """Coach a live vendor on their published packages, post-launch conversion focus."""
    result = await review_vendor_packages(payload=payload, language_model=language_model)
    summary = result.summary.strip() or "Here are a few ways to make your packages easier to book."
    return CopilotReviewPackagesResponse(
        overall_ok=result.overall_ok,
        summary=summary,
        package_feedback=result.package_feedback,
    )
