"""Admin console HTTP routes — aggregated from domain-focused modules."""

from fastapi import APIRouter

from app.features.admin.http import (
    platform_bookings,
    platform_dashboard,
    platform_directory,
    platform_financials,
    platform_team,
    platform_trust,
)

router = APIRouter()
router.include_router(platform_dashboard.router)
router.include_router(platform_bookings.router)
router.include_router(platform_financials.router)
router.include_router(platform_directory.router)
router.include_router(platform_trust.router)
router.include_router(platform_team.router)
