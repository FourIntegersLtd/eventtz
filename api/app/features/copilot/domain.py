"""Pure Growth Score maths for the vendor Growth Co-pilot.

Ported from the baseline `backend/app/features/vendor_copilot/score.py`, byte-for-byte:
same point values, same lever order, same thresholds. `api/tests/unit/test_copilot_domain.py`
pins the literal numbers the acceptance suite also freezes (an empty profile scores 34/100).

Package completeness here is a deliberately thinner copy of `vendors/domain_packages.py`
(this slice may not import another slice's `domain*` module): it only has to decide, from
each package dict, whether it looks "configured" and "complete enough" for the 85-point cap
below, not to validate a save — that full ruleset lives in `vendors/domain_packages.py`.
"""

from __future__ import annotations

from typing import Any

# The five levers, in the fixed order the baseline API returns them.
_LISTING_MAX = 25
_RESPONSE_MAX = 25
_CONVERSION_MAX = 25
_REVIEWS_MAX = 15
_AVAILABILITY_MAX = 10

_MIN_COMPLETE_DETAILS_CHARS = 40
_MIN_COMPLETE_TITLE_CHARS = 3


def _clamp_score(value: float) -> int:
    """Round to the nearest point and keep it inside 0-100."""
    return max(0, min(100, int(round(value))))


def _lever_status(ratio: float) -> str:
    """`good` at 75%+ of a lever's max, `ok` at 45%+, `needs_work` below that."""
    if ratio >= 0.75:
        return "good"
    if ratio >= 0.45:
        return "ok"
    return "needs_work"


def _portfolio_photo_count(payload: dict[str, Any]) -> int:
    """How many portfolio photos the vendor has attached, from whichever field holds them."""
    file_names = payload.get("portfolioFileNames")
    if isinstance(file_names, list):
        return len([name for name in file_names if str(name).strip()])
    image_urls = payload.get("portfolioImageUrls")
    if isinstance(image_urls, list):
        return len([url for url in image_urls if str(url).strip()])
    return 0


def _is_configured_package(package: dict[str, Any]) -> bool:
    """True once any field on a package row has been touched at all."""
    return bool(
        str(package.get("title") or "").strip()
        or str(package.get("price") or "").strip()
        or str(package.get("details") or "").strip()
    )


def _is_complete_package(package: dict[str, Any]) -> bool:
    """True when a package has a real title, a price, and a full-enough description.

    A thinner stand-in for `vendors.domain_packages.is_complete_package`: good enough to
    decide the 85-point cap below, not a save-time validation rule.
    """
    title = str(package.get("title") or "").strip()
    price = str(package.get("price") or "").strip()
    details = str(package.get("details") or "").strip()
    return (
        len(title) >= _MIN_COMPLETE_TITLE_CHARS
        and bool(price)
        and len(details) >= _MIN_COMPLETE_DETAILS_CHARS
    )


def _count_complete_packages(payload: dict[str, Any]) -> tuple[int, int]:
    """`(complete_count, configured_count)` for the packages in the payload."""
    packages = payload.get("packages")
    if not isinstance(packages, list):
        return 0, 0
    configured = [pkg for pkg in packages if isinstance(pkg, dict) and _is_configured_package(pkg)]
    complete = [pkg for pkg in configured if _is_complete_package(pkg)]
    return len(complete), len(configured)


def _listing_lever(payload: dict[str, Any]) -> dict[str, Any]:
    """Profile photo, bio, packages, portfolio photos and services offered."""
    complete_packages, total_packages = _count_complete_packages(payload)
    bio = str(payload.get("aiBioDraft") or payload.get("bio") or "").strip()
    profile_image = str(payload.get("profileImageUrl") or "").strip()
    portfolio_count = _portfolio_photo_count(payload)
    services = payload.get("servicesOffered")
    service_count = len(services) if isinstance(services, list) else 0

    points = 0.0
    if profile_image:
        points += 6
    if len(bio) >= 40:
        points += 5
    if complete_packages >= 1:
        points += 8
    elif total_packages >= 1:
        points += 3
    if portfolio_count >= 3:
        points += 4
    elif portfolio_count >= 1:
        points += 2
    if service_count >= 1:
        points += 2

    ratio = points / _LISTING_MAX
    tip = "Add a profile photo, clear packages, and at least 3 portfolio photos."
    if complete_packages >= 1 and profile_image and portfolio_count >= 3:
        tip = "Your listing looks strong. Keep packages and photos up to date."
    elif not profile_image:
        tip = "Add a profile photo. Clients trust listings with a face or logo."
    elif complete_packages < 1:
        tip = "Finish at least one complete package with name, price, and what's included."
    elif portfolio_count < 3:
        tip = "Add more portfolio photos. 3 or more helps clients choose you."

    return {
        "key": "listing",
        "label": "Listing quality",
        "score": _clamp_score(points / _LISTING_MAX * 100),
        "max_score": 100,
        "status": _lever_status(ratio),
        "tip": tip,
    }


def _response_lever(overview: dict[str, Any]) -> dict[str, Any]:
    """How fast the vendor replies to enquiries, and how many have expired unanswered."""
    average_response_seconds = overview.get("avg_response_seconds")
    expired_enquiries = int(overview.get("expired_enquiries") or 0)
    pending_enquiries = int(overview.get("pending_enquiries") or 0)

    points = 12.0
    if average_response_seconds is not None:
        if average_response_seconds <= 3600:
            points = 25.0
        elif average_response_seconds <= 7200:
            points = 20.0
        elif average_response_seconds <= 14400:
            points = 14.0
        elif average_response_seconds <= 43200:
            points = 8.0
        else:
            points = 4.0
    if expired_enquiries > 0:
        points = max(0.0, points - expired_enquiries * 4)
    if pending_enquiries > 0 and average_response_seconds is None:
        points = 10.0

    ratio = points / _RESPONSE_MAX
    tip = "Reply to new enquiries within 2 hours to win more bookings."
    if pending_enquiries > 0:
        plural = "y" if pending_enquiries == 1 else "ies"
        tip = f"You have {pending_enquiries} pending enquir{plural}. Reply soon to protect your score."
    elif average_response_seconds is not None and average_response_seconds <= 7200:
        tip = "Great response time. Keep replying quickly to stay visible."

    return {
        "key": "response",
        "label": "Response speed",
        "score": _clamp_score(points / _RESPONSE_MAX * 100),
        "max_score": 100,
        "status": _lever_status(ratio),
        "tip": tip,
    }


def _conversion_lever(overview: dict[str, Any]) -> dict[str, Any]:
    """The share of enquiries that turn into bookings."""
    enquiries = int(overview.get("enquiries") or 0)
    conversion_rate = float(overview.get("conversion_rate") or 0.0)

    points = 10.0
    if enquiries >= 3:
        if conversion_rate >= 0.5:
            points = 25.0
        elif conversion_rate >= 0.3:
            points = 20.0
        elif conversion_rate >= 0.15:
            points = 14.0
        elif conversion_rate >= 0.05:
            points = 8.0
        else:
            points = 4.0
    elif enquiries >= 1:
        points = 12.0

    ratio = points / _CONVERSION_MAX
    profile_views = int(overview.get("profile_views") or 0)
    tip = "When enquiries arrive, accept promptly and keep packages clear to convert."
    if profile_views >= 5 and enquiries == 0:
        tip = "Clients are viewing your profile but not enquiring yet. Sharpen packages and photos."
    elif enquiries >= 1 and conversion_rate < 0.15:
        tip = "Focus on accepting suitable enquiries and confirming details quickly."

    return {
        "key": "conversion",
        "label": "Booking conversion",
        "score": _clamp_score(points / _CONVERSION_MAX * 100),
        "max_score": 100,
        "status": _lever_status(ratio),
        "tip": tip,
    }


def _reviews_lever(overview: dict[str, Any]) -> dict[str, Any]:
    """How many reviews the vendor has, and how good they are."""
    average_rating = float(overview.get("avg_customer_rating") or 0.0)
    review_count = int(overview.get("review_count") or 0)

    points = 8.0
    if review_count >= 3 and average_rating >= 4.5:
        points = 15.0
    elif review_count >= 1 and average_rating >= 4.0:
        points = 12.0
    elif review_count >= 1:
        points = 9.0

    ratio = points / _REVIEWS_MAX
    tip = "Complete bookings and ask happy clients to leave a review."
    if review_count >= 3 and average_rating >= 4.5:
        tip = "Strong reviews. Mention your best work in your bio."

    return {
        "key": "reviews",
        "label": "Client reviews",
        "score": _clamp_score(points / _REVIEWS_MAX * 100),
        "max_score": 100,
        "status": _lever_status(ratio),
        "tip": tip,
    }


def _availability_lever(payload: dict[str, Any]) -> dict[str, Any]:
    """Weekday coverage and a daily booking limit."""
    weekdays = payload.get("availableWeekdays")
    weekday_count = len(weekdays) if isinstance(weekdays, list) else 0
    max_per_day = payload.get("maxBookingsPerDay")

    points = 4.0
    if weekday_count >= 5:
        points += 4.0
    elif weekday_count >= 3:
        points += 2.0
    if max_per_day is not None and int(max_per_day or 0) >= 1:
        points += 2.0

    ratio = points / _AVAILABILITY_MAX
    tip = "Set weekday availability and a daily booking limit so clients know you are bookable."
    if weekday_count >= 5:
        tip = "Good availability coverage. Block dates when you are fully booked."

    return {
        "key": "availability",
        "label": "Availability",
        "score": _clamp_score(points / _AVAILABILITY_MAX * 100),
        "max_score": 100,
        "status": _lever_status(ratio),
        "tip": tip,
    }


def compute_growth_score(
    *,
    payload: dict[str, Any],
    listing_visible: bool,
    payouts_verified: bool,
    analytics_overview: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The vendor's Growth Score (0-100) and its five-lever breakdown.

    Pure function of the profile payload and analytics facts the caller already loaded —
    no I/O here. `api/tests/unit/test_copilot_domain.py` pins an empty payload at 34/100,
    matching the acceptance suite's frozen value.
    """
    levers = [
        _listing_lever(payload),
        _response_lever(analytics_overview or {}),
        _conversion_lever(analytics_overview or {}),
        _reviews_lever(analytics_overview or {}),
        _availability_lever(payload),
    ]

    weights = {"listing": 25, "response": 25, "conversion": 25, "reviews": 15, "availability": 10}
    total = sum((lever["score"] / 100.0) * weights[lever["key"]] for lever in levers)

    incomplete_packages = [
        package
        for package in (payload.get("packages") or [])
        if isinstance(package, dict)
        and (package.get("title") or package.get("price"))
        and not _is_complete_package(package)
    ]
    if incomplete_packages:
        total = min(total, 85.0)

    return {
        "score": _clamp_score(total),
        "levers": levers,
        "listing_visible": listing_visible,
        "payouts_verified": payouts_verified,
    }
