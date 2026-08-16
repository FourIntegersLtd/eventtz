"""Vendor listing photo resolution (public) and admin overrides (order + hide)."""

from __future__ import annotations

from typing import Any

from app.core.db import get_db
from app.features.vendors import messages as vendor_messages
from app.features.vendors.profile import get_vendor_profile
from app.features.vendors.profile_form_validation import normalize_payload_fields


def _str_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    url = value.strip()
    return url or None


def _url_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        url = _str_url(item)
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def allowed_listing_media_urls(payload: dict[str, Any]) -> set[str]:
    allowed: set[str] = set()
    profile = _str_url(payload.get("profileImageUrl"))
    if profile:
        allowed.add(profile)
    for url in _url_list(payload.get("portfolioFileNames")):
        allowed.add(url)
    return allowed


def default_listing_display_order(payload: dict[str, Any]) -> list[str]:
    """Vendor default: profile photo first, then portfolio order."""
    allowed = allowed_listing_media_urls(payload)
    profile = _str_url(payload.get("profileImageUrl"))
    portfolio = [url for url in _url_list(payload.get("portfolioFileNames")) if url in allowed]
    if profile and profile in allowed:
        return [profile, *[url for url in portfolio if url != profile]]
    return portfolio


def _merge_unique(
    preferred: list[str],
    fallback: list[str],
    *,
    allowed: set[str],
    hidden: set[str] | None = None,
) -> list[str]:
    hidden = hidden or set()
    ordered: list[str] = []
    seen: set[str] = set()
    for url in [*preferred, *fallback]:
        if url not in allowed or url in hidden or url in seen:
            continue
        seen.add(url)
        ordered.append(url)
    return ordered


def _base_display_order(payload: dict[str, Any]) -> list[str]:
    stored = _url_list(payload.get("listingDisplayOrder"))
    default = default_listing_display_order(payload)
    if stored:
        return stored
    legacy = _str_url(payload.get("listingCoverImageUrl"))
    if legacy:
        return [legacy, *[url for url in default if url != legacy]]
    return default


def public_listing_image_urls_from_payload(payload: dict[str, Any]) -> list[str]:
    """Resolved public gallery/card order after admin overrides and hidden filter."""
    allowed = allowed_listing_media_urls(payload)
    hidden = set(_url_list(payload.get("listingHiddenImageUrls")))
    return _merge_unique(
        _base_display_order(payload),
        default_listing_display_order(payload),
        allowed=allowed,
        hidden=hidden,
    )


def listing_cover_image_url_from_payload(payload: dict[str, Any]) -> str | None:
    """Public listing cover is the first visible image in resolved order."""
    urls = public_listing_image_urls_from_payload(payload)
    return urls[0] if urls else None


def _validate_url_list(urls: list[str], allowed: set[str]) -> list[str]:
    clean: list[str] = []
    seen: set[str] = set()
    for url in urls:
        item = url.strip()
        if not item or item in seen:
            continue
        if item not in allowed:
            raise ValueError(vendor_messages.LISTING_MEDIA_URL_INVALID)
        seen.add(item)
        clean.append(item)
    return clean


def update_vendor_listing_media(
    user_id: str,
    display_order: list[str],
    hidden_image_urls: list[str],
) -> dict[str, Any] | None:
    """Persist admin listing photo overrides without changing vendor portfolio order."""
    existing = get_vendor_profile(user_id)
    if not existing:
        return None

    payload: dict[str, Any] = {}
    if isinstance(existing.get("payload"), dict):
        payload.update(existing["payload"])

    allowed = allowed_listing_media_urls(payload)
    hidden = _validate_url_list(hidden_image_urls, allowed)
    order = _validate_url_list(display_order, allowed)
    default = default_listing_display_order(payload)

    if not order and not hidden:
        payload.pop("listingDisplayOrder", None)
        payload.pop("listingHiddenImageUrls", None)
    else:
        if order and order == default and not hidden:
            payload.pop("listingDisplayOrder", None)
        elif order:
            payload["listingDisplayOrder"] = order
        else:
            payload.pop("listingDisplayOrder", None)
        if hidden:
            payload["listingHiddenImageUrls"] = hidden
        else:
            payload.pop("listingHiddenImageUrls", None)

    payload.pop("listingCoverImageUrl", None)
    payload.pop("listingTailImageUrls", None)

    payload = normalize_payload_fields(payload, user_id)
    get_db().table("vendors").update({"payload": payload}).eq("user_id", user_id).execute()
    return get_vendor_profile(user_id)


def listing_media_state_from_row(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    urls = public_listing_image_urls_from_payload(payload)
    return {
        "listing_cover_image_url": urls[0] if urls else None,
        "display_order": _url_list(payload.get("listingDisplayOrder")),
        "hidden_image_urls": _url_list(payload.get("listingHiddenImageUrls")),
    }
