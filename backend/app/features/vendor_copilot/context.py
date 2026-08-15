"""Build vendor snapshot for Growth Co-pilot grounding."""

from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.features.vendor_copilot.score import compute_growth_score
from app.features.vendors.analytics import get_vendor_analytics
from app.features.vendors.profile import get_vendor_profile

logger = get_logger(__name__)


def _business_name(payload: dict[str, Any]) -> str:
    return str(payload.get("businessName") or payload.get("business_name") or "Your business").strip()


def _load_pending_bookings(vendor_user_id: str, *, limit: int = 5) -> list[dict[str, Any]]:
    try:
        res = (
            get_db()
            .table("booking_requests")
            .select("id,event_name,event_date,status,created_at,notes")
            .eq("vendor_user_id", vendor_user_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return [r for r in rows if isinstance(r, dict)]
    except Exception:
        logger.exception("vendor_copilot: pending bookings load failed")
        return []


def build_vendor_context(vendor_user_id: str, *, analytics_days: int = 90) -> dict[str, Any]:
    """Aggregate profile, analytics, score, and pending work for copilot prompts."""
    profile_row = get_vendor_profile(vendor_user_id)
    if not profile_row:
        return {"found": False}

    payload = profile_row.get("payload")
    if not isinstance(payload, dict):
        payload = {}

    analytics = get_vendor_analytics(vendor_user_id, days=analytics_days)
    overview = analytics.get("overview") if isinstance(analytics.get("overview"), dict) else {}
    funnel = analytics.get("funnel") if isinstance(analytics.get("funnel"), dict) else {}

    score_data = compute_growth_score(
        payload=payload,
        listing_visible=bool(profile_row.get("listing_visible")),
        payouts_verified=bool(profile_row.get("payouts_verified")),
        analytics_overview=overview,
    )

    pending = _load_pending_bookings(vendor_user_id)

    services = payload.get("servicesOffered")
    service_list = [str(s) for s in services] if isinstance(services, list) else []

    return {
        "found": True,
        "business_name": _business_name(payload),
        "base_city": str(payload.get("baseCity") or "").strip(),
        "country_code": str(payload.get("countryCode") or "GB").strip(),
        "services": service_list,
        "profile_updated_at": profile_row.get("updated_at"),
        "listing_visible": bool(profile_row.get("listing_visible")),
        "payouts_verified": bool(profile_row.get("payouts_verified")),
        "approval_status": str(profile_row.get("approval_status") or "pending"),
        "growth_score": score_data["score"],
        "growth_levers": score_data["levers"],
        "analytics_overview": overview,
        "funnel": funnel,
        "pending_bookings": pending,
        "pending_count": len(pending),
        "payload": payload,
        "payload_summary": {
            "package_count": len(payload.get("packages") or []) if isinstance(payload.get("packages"), list) else 0,
            "has_bio": bool(str(payload.get("aiBioDraft") or "").strip()),
            "has_profile_image": bool(str(payload.get("profileImageUrl") or "").strip()),
        },
    }


def format_vendor_copilot_prompt_context(ctx: dict[str, Any]) -> str:
    """Compact JSON facts block for LLM system prompt — no secrets."""
    if not ctx.get("found"):
        return "Vendor profile not found."
    safe = {
        "business_name": ctx.get("business_name"),
        "base_city": ctx.get("base_city"),
        "services": ctx.get("services"),
        "listing_visible": ctx.get("listing_visible"),
        "payouts_verified": ctx.get("payouts_verified"),
        "growth_score": ctx.get("growth_score"),
        "growth_levers": ctx.get("growth_levers"),
        "analytics_overview": ctx.get("analytics_overview"),
        "funnel": ctx.get("funnel"),
        "pending_bookings": [
            {
                "id": b.get("id"),
                "event_name": b.get("event_name"),
                "event_date": b.get("event_date"),
            }
            for b in (ctx.get("pending_bookings") or [])
            if isinstance(b, dict)
        ],
        "payload_summary": ctx.get("payload_summary"),
    }
    return json.dumps(safe, ensure_ascii=False, indent=2)
