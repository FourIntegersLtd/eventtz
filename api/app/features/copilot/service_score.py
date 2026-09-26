"""The vendor's Growth Score: `compute_growth_score` wired up to the real profile and reviews.

Reads the vendor's profile only through `vendors.service_profile.get_profile_state` and
their review stats only through `reviews.service_vendor.list_own_reviews` — never those
slices' repositories, domain or models, per the cross-slice rule in `api/CONTRIBUTING.md`.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.features.copilot.domain import compute_growth_score
from app.features.copilot.schemas import GrowthScoreLever, GrowthScoreResponse
from app.features.reviews.service_vendor import list_own_reviews
from app.features.vendors.service_profile import get_profile_state


async def get_growth_score(session: AsyncSession, principal: Principal) -> GrowthScoreResponse:
    """The vendor's current Growth Score, or a fixed zero when they have no profile yet."""
    profile = await get_profile_state(session, principal)
    if profile.updated_at is None:
        return GrowthScoreResponse(score=0, levers=[], listing_visible=False, payouts_verified=False)

    reviews = await list_own_reviews(session, vendor_user_id=principal.id)
    analytics_overview = {
        "avg_customer_rating": reviews.average_rating,
        "review_count": reviews.review_count,
    }

    data = compute_growth_score(
        payload=profile.profile_form_data,
        listing_visible=profile.listing_visible,
        payouts_verified=profile.payouts_verified,
        analytics_overview=analytics_overview,
    )
    return GrowthScoreResponse(
        score=data["score"],
        levers=[GrowthScoreLever(**lever) for lever in data["levers"]],
        listing_visible=data["listing_visible"],
        payouts_verified=data["payouts_verified"],
    )
