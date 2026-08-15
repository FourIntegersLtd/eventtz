"""Deterministic Growth Score for vendor marketplace performance."""

from __future__ import annotations

from typing import Any

from app.features.vendors.package_quality import count_complete_packages, is_complete_package


def _clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _lever_status(ratio: float) -> str:
    if ratio >= 0.75:
        return "good"
    if ratio >= 0.45:
        return "ok"
    return "needs_work"


def _portfolio_count(payload: dict[str, Any]) -> int:
    names = payload.get("portfolioFileNames")
    if isinstance(names, list):
        return len([n for n in names if str(n).strip()])
    urls = payload.get("portfolioImageUrls")
    if isinstance(urls, list):
        return len([u for u in urls if str(u).strip()])
    return 0


def compute_growth_score(
    *,
    payload: dict[str, Any],
    listing_visible: bool,
    payouts_verified: bool,
    analytics_overview: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return score 0-100 and lever breakdown from profile + analytics facts."""
    levers: list[dict[str, Any]] = []

    complete_pkgs, total_pkgs = count_complete_packages(payload)
    bio = str(payload.get("aiBioDraft") or payload.get("bio") or "").strip()
    profile_image = str(payload.get("profileImageUrl") or "").strip()
    portfolio_n = _portfolio_count(payload)
    svcs = payload.get("servicesOffered")
    service_count = len(svcs) if isinstance(svcs, list) else 0

    listing_pts = 0.0
    if profile_image:
        listing_pts += 6
    if len(bio) >= 40:
        listing_pts += 5
    if complete_pkgs >= 1:
        listing_pts += 8
    elif total_pkgs >= 1:
        listing_pts += 3
    if portfolio_n >= 3:
        listing_pts += 4
    elif portfolio_n >= 1:
        listing_pts += 2
    if service_count >= 1:
        listing_pts += 2
    listing_max = 25
    listing_ratio = listing_pts / listing_max
    listing_tip = "Add a profile photo, clear packages, and at least 3 portfolio photos."
    if complete_pkgs >= 1 and profile_image and portfolio_n >= 3:
        listing_tip = "Your listing looks strong. Keep packages and photos up to date."
    elif not profile_image:
        listing_tip = "Add a profile photo — clients trust listings with a face or logo."
    elif complete_pkgs < 1:
        listing_tip = "Finish at least one complete package with name, price, and what's included."
    elif portfolio_n < 3:
        listing_tip = "Add more portfolio photos — 3 or more helps clients choose you."

    levers.append(
        {
            "key": "listing",
            "label": "Listing quality",
            "score": _clamp_score(listing_pts / listing_max * 100),
            "max_score": 100,
            "status": _lever_status(listing_ratio),
            "tip": listing_tip,
        }
    )

    overview = analytics_overview or {}
    avg_resp = overview.get("avg_response_seconds")
    expired = int(overview.get("expired_enquiries") or 0)
    pending = int(overview.get("pending_enquiries") or 0)
    enquiries = int(overview.get("enquiries") or 0)

    resp_pts = 12.0
    if avg_resp is not None:
        if avg_resp <= 3600:
            resp_pts = 25.0
        elif avg_resp <= 7200:
            resp_pts = 20.0
        elif avg_resp <= 14400:
            resp_pts = 14.0
        elif avg_resp <= 43200:
            resp_pts = 8.0
        else:
            resp_pts = 4.0
    if expired > 0:
        resp_pts = max(0.0, resp_pts - expired * 4)
    if pending > 0 and avg_resp is None:
        resp_pts = 10.0
    resp_max = 25
    resp_ratio = resp_pts / resp_max
    resp_tip = "Reply to new enquiries within 2 hours to win more bookings."
    if pending > 0:
        resp_tip = f"You have {pending} pending enquir{'y' if pending == 1 else 'ies'} — reply soon to protect your score."
    elif avg_resp is not None and avg_resp <= 7200:
        resp_tip = "Great response time. Keep replying quickly to stay visible."

    levers.append(
        {
            "key": "response",
            "label": "Response speed",
            "score": _clamp_score(resp_pts / resp_max * 100),
            "max_score": 100,
            "status": _lever_status(resp_ratio),
            "tip": resp_tip,
        }
    )

    conv_rate = float(overview.get("conversion_rate") or 0.0)
    conv_pts = 10.0
    if enquiries >= 3:
        if conv_rate >= 0.5:
            conv_pts = 25.0
        elif conv_rate >= 0.3:
            conv_pts = 20.0
        elif conv_rate >= 0.15:
            conv_pts = 14.0
        elif conv_rate >= 0.05:
            conv_pts = 8.0
        else:
            conv_pts = 4.0
    elif enquiries >= 1:
        conv_pts = 12.0
    conv_max = 25
    conv_ratio = conv_pts / conv_max
    profile_views = int(overview.get("profile_views") or 0)
    conv_tip = "When enquiries arrive, accept promptly and keep packages clear to convert."
    if profile_views >= 5 and enquiries == 0:
        conv_tip = "Clients are viewing your profile but not enquiring yet — sharpen packages and photos."
    elif enquiries >= 1 and conv_rate < 0.15:
        conv_tip = "Focus on accepting suitable enquiries and confirming details quickly."

    levers.append(
        {
            "key": "conversion",
            "label": "Booking conversion",
            "score": _clamp_score(conv_pts / conv_max * 100),
            "max_score": 100,
            "status": _lever_status(conv_ratio),
            "tip": conv_tip,
        }
    )

    avg_rating = float(overview.get("avg_customer_rating") or 0.0)
    review_count = int(overview.get("review_count") or 0)
    review_pts = 8.0
    if review_count >= 3 and avg_rating >= 4.5:
        review_pts = 15.0
    elif review_count >= 1 and avg_rating >= 4.0:
        review_pts = 12.0
    elif review_count >= 1:
        review_pts = 9.0
    review_max = 15
    review_ratio = review_pts / review_max
    review_tip = "Complete bookings and ask happy clients to leave a review."
    if review_count >= 3 and avg_rating >= 4.5:
        review_tip = "Strong reviews — mention your best work in your bio."

    levers.append(
        {
            "key": "reviews",
            "label": "Client reviews",
            "score": _clamp_score(review_pts / review_max * 100),
            "max_score": 100,
            "status": _lever_status(review_ratio),
            "tip": review_tip,
        }
    )

    weekdays = payload.get("availableWeekdays")
    weekday_count = len(weekdays) if isinstance(weekdays, list) else 0
    max_per_day = payload.get("maxBookingsPerDay")
    avail_pts = 4.0
    if weekday_count >= 5:
        avail_pts += 4.0
    elif weekday_count >= 3:
        avail_pts += 2.0
    if max_per_day is not None and int(max_per_day or 0) >= 1:
        avail_pts += 2.0
    avail_max = 10
    avail_ratio = avail_pts / avail_max
    avail_tip = "Set weekday availability and a daily booking limit so clients know you are bookable."
    if weekday_count >= 5:
        avail_tip = "Good availability coverage. Block dates when you are fully booked."

    levers.append(
        {
            "key": "availability",
            "label": "Availability",
            "score": _clamp_score(avail_pts / avail_max * 100),
            "max_score": 100,
            "status": _lever_status(avail_ratio),
            "tip": avail_tip,
        }
    )

    weights = {"listing": 25, "response": 25, "conversion": 25, "reviews": 15, "availability": 10}
    total = 0.0
    for lev in levers:
        w = weights.get(lev["key"], 0)
        total += (lev["score"] / 100.0) * w

    incomplete_pkgs = [
        p
        for p in (payload.get("packages") or [])
        if isinstance(p, dict) and (p.get("title") or p.get("price")) and not is_complete_package(p)
    ]
    if incomplete_pkgs:
        total = min(total, 85.0)

    return {
        "score": _clamp_score(total),
        "levers": levers,
        "listing_visible": listing_visible,
        "payouts_verified": payouts_verified,
    }
