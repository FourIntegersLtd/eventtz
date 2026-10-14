"""Vendor onboarding AI helpers: write a public bio, QA a portfolio photo, coach on packages.

New file (the existing `vendors/service_profile.py` and friends are untouched). Every OpenAI
call goes through the `LanguageModel` port, so with no key configured every one of these
raises `LanguageModelUnavailable` (503) before any prompt is built — matching the baseline's
`require_openai_client()`-first behaviour byte for byte.

Ported from the baseline `backend/app/features/vendors/onboarding_ai.py`. The router-thin
guard only lets `vendors/router_ai.py` reach a sibling module named exactly `schemas`/`errors`
or one starting with `service`, so this module also holds the two small validation errors
the photo-upload route raises, instead of a separate `errors_ai.py` the router could not import.
"""

from __future__ import annotations

import asyncio
import base64

from pydantic import BaseModel, Field

from app.core.errors import InvalidInput
from app.core.ports import ChatMessage, LanguageModel
from app.features.vendors.schemas_ai import (
    AnalyzePortfolioImageResponse,
    GenerateVendorBioBody,
    GenerateVendorBioResponse,
    PackageCoachPackageFeedback,
    PackageCoachTip,
    ReviewVendorPackagesBody,
    ReviewVendorPackagesResponse,
)

# Re-exported so `router_ai.py` can import every schema it needs from this one module: the
# router-thin guard only lets a router reach a sibling module named `schemas`/`errors` or
# one starting with `service`, and `schemas_ai` matches neither.
__all__ = [
    "AnalyzePortfolioImageResponse",
    "GenerateVendorBioBody",
    "GenerateVendorBioResponse",
    "ReviewVendorPackagesBody",
    "ReviewVendorPackagesResponse",
    "ImageRequired",
    "ImageContentTypeInvalid",
    "generate_vendor_public_bio",
    "analyze_portfolio_image",
    "review_vendor_packages",
]

# Both the baseline's OPENAI_BIO_MODEL and OPENAI_VISION_MODEL are this same model.
ONBOARDING_AI_MODEL = "gpt-6-luna"

# Profile fields safe to hand to the model: nothing that identifies a real person or account.
_BIO_SAFE_KEYS = frozenset(
    {
        "businessName",
        "baseCity",
        "countryCode",
        "servicesOffered",
        "bio",
        "yearsExperience",
        "packages",
        "portfolioImageUrls",
    }
)


class ImageRequired(InvalidInput):
    """The portfolio photo upload was empty."""

    code = "vendor_onboarding_ai_image_required"
    default_message = "Please choose an image to upload."


class ImageContentTypeInvalid(InvalidInput):
    """The upload's content type is not `image/*`."""

    code = "vendor_onboarding_ai_image_content_type_invalid"
    default_message = "Only image uploads are supported."


class _BioReply(BaseModel):
    """The model's structured reply for a bio-generation call."""

    bio: str = ""


class _PortfolioImageReply(BaseModel):
    """The model's structured reply for a portfolio-photo QA call."""

    ok: bool = True
    score: int = 3
    summary: str = ""


class _PackageReviewReply(BaseModel):
    """The model's structured reply for a package-coaching call."""

    summary: str = ""
    package_feedback: list[PackageCoachPackageFeedback] = Field(default_factory=list)


def _sanitize_payload(payload: dict[str, object]) -> dict[str, object]:
    """Only the profile fields the model is allowed to see, dropping everything else."""
    return {key: value for key, value in payload.items() if key in _BIO_SAFE_KEYS}


async def generate_vendor_public_bio(
    *, payload: dict[str, object], language_model: LanguageModel
) -> GenerateVendorBioResponse:
    """Write a short public bio from the vendor's onboarding form.

    Raises the port's own errors (`LanguageModelUnavailable` and friends) unchanged: with
    no OpenAI key configured this is always `LanguageModelUnavailable` (503), reached before
    any prompt is built, matching the baseline's `require_openai_client()`-first behaviour.
    """
    safe_payload = _sanitize_payload(payload)
    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "Write a warm, concise public bio (60-120 words) for a UK events vendor, "
                "in plain English, from the JSON profile details given. No contact details."
            ),
        },
        {"role": "user", "content": str(safe_payload)},
    ]
    # The model call blocks for seconds; a worker thread keeps the event loop serving others.
    reply = await asyncio.to_thread(
        language_model.parse,
        model=ONBOARDING_AI_MODEL,
        messages=messages,
        reply_model=_BioReply,
        purpose="vendor_onboarding_bio",
    )
    return GenerateVendorBioResponse(bio=reply.bio.strip())


async def analyze_portfolio_image(
    *, image_bytes: bytes, content_type: str, language_model: LanguageModel
) -> AnalyzePortfolioImageResponse:
    """QA one portfolio photo upload: a 1-5 quality score and a short summary.

    Validates the upload itself (non-empty, an image content type) before ever touching
    the language model, so those two checks give their 400s even with no OpenAI key.
    """
    if not image_bytes:
        raise ImageRequired()
    if not content_type.strip().lower().startswith("image/"):
        raise ImageContentTypeInvalid()
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "Rate this vendor portfolio photo's quality for a marketplace listing. "
                "Reply with a 1-5 score and a one-sentence summary of what to improve."
            ),
        },
        {"role": "user", "content": "Rate this photo."},
    ]
    reply = await asyncio.to_thread(
        language_model.parse,
        model=ONBOARDING_AI_MODEL,
        messages=messages,
        reply_model=_PortfolioImageReply,
        purpose="vendor_onboarding_portfolio_image",
        image_data_url=data_url,
    )
    clamped_score = max(1, min(5, reply.score))
    return AnalyzePortfolioImageResponse(ok=reply.ok, score=clamped_score, summary=reply.summary.strip())


def _legacy_tips(package_feedback: list[PackageCoachPackageFeedback]) -> list[PackageCoachTip]:
    """The per-package feedback, flattened into the legacy flat `tips` shape some screens still read."""
    tips: list[PackageCoachTip] = []
    for feedback in package_feedback:
        for item in feedback.items:
            tips.append(
                PackageCoachTip(
                    severity="suggestion",
                    package_id=feedback.package_id,
                    package_title=feedback.package_title,
                    code="package_feedback",
                    message=item,
                )
            )
    return tips


async def review_vendor_packages(
    *, payload: dict[str, object], language_model: LanguageModel
) -> ReviewVendorPackagesResponse:
    """Coach the vendor on their packages during onboarding: clearer titles, fuller descriptions.

    Raises `LanguageModelUnavailable` first, with no OpenAI key configured, before any
    package is even read — the same "reaches OpenAI immediately" baseline quirk as the bio call.
    """
    safe_payload = _sanitize_payload(payload)
    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "Review these UK events vendor packages for clarity and completeness. "
                "Suggest a clearer title, fuller details, or a duration where useful."
            ),
        },
        {"role": "user", "content": str(safe_payload.get("packages", []))},
    ]
    reply = await asyncio.to_thread(
        language_model.parse,
        model=ONBOARDING_AI_MODEL,
        messages=messages,
        reply_model=_PackageReviewReply,
        purpose="vendor_onboarding_package_review",
    )
    return ReviewVendorPackagesResponse(
        overall_ok=True,
        summary=reply.summary.strip(),
        package_feedback=reply.package_feedback,
        tips=_legacy_tips(reply.package_feedback),
    )
