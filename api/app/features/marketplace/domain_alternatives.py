"""Pure rules for "other vendors to try" suggestions: the search to run and how a reply time reads.

Ported from the baseline's `enquiry_reminders._suggest_alternative_vendors` and
`public_metrics.format_usual_reply_seconds`. No I/O.
"""

from __future__ import annotations

from typing import Any

# How many alternatives an email lists, and how many search results are looked through to find them.
ALTERNATIVES_LIMIT = 5
ALTERNATIVES_SEARCH_LIMIT = 40
# The most dates from the original search that are carried over.
_MAX_SEARCH_DATES = 3
VENDOR_NAME_FALLBACK = "Vendor"
REPLY_TIME_UNKNOWN = "Reply time varies"


def format_usual_reply_seconds(seconds: float | None) -> str | None:
    """A short phrase for how fast a vendor usually replies, e.g. "within 2 hours"; `None` when unknown."""
    if seconds is None or seconds != seconds:  # NaN is the only value not equal to itself
        return None
    if seconds < 60:
        count, unit = max(1, round(seconds)), "second"
    elif seconds < 3600:
        count, unit = max(1, round(seconds / 60)), "minute"
    elif seconds < 86400:
        count, unit = max(1, round(seconds / 3600)), "hour"
    else:
        count, unit = max(1, round(seconds / 86400)), "day"
    return f"within {count} {unit}{'' if count == 1 else 's'}"


def usual_reply_label(avg_response_seconds: float | None) -> str:
    """ "Usually replies within 2 hours", or "Reply time varies" when the vendor has no reply history."""
    phrase = format_usual_reply_seconds(avg_response_seconds)
    return f"Usually replies {phrase}" if phrase else REPLY_TIME_UNKNOWN


def search_params_for_alternatives(
    search_context: dict[str, Any] | None, silent_vendor_payload: dict[str, Any] | None
) -> dict[str, str | None]:
    """The search (types, location, q, dates, country) that finds vendors similar to the one that went quiet.

    Starts from what the client searched when they sent the enquiry; a missing service
    type or place falls back to the silent vendor's first service and base city.
    """
    context = search_context or {}
    vendor_form = silent_vendor_payload or {}

    raw_types = context.get("types")
    types = (
        ",".join(str(service) for service in raw_types if service) if isinstance(raw_types, list) else None
    )
    if not types:
        services = vendor_form.get("servicesOffered")
        if isinstance(services, list) and services:
            types = str(services[0])

    location = str(context.get("location") or "").strip() or None
    if not location:
        base_city = vendor_form.get("baseCity")
        if isinstance(base_city, str) and base_city.strip():
            location = base_city.strip()

    raw_dates = context.get("dates")
    dates = None
    if isinstance(raw_dates, list) and raw_dates:
        dates = ",".join(str(day) for day in raw_dates[:_MAX_SEARCH_DATES] if day)

    return {
        "types": types,
        "location": location,
        "search": str(context.get("q") or "").strip() or None,
        "dates": dates,
        "country": str(context.get("country") or "GB").strip() or "GB",
    }


def vendor_display_name(payload: dict[str, Any]) -> str:
    """The business name as typed (trimmed), or "Vendor" when the form has none."""
    raw_name = payload.get("businessName")
    if isinstance(raw_name, str) and raw_name.strip():
        return raw_name.strip()
    return VENDOR_NAME_FALLBACK
