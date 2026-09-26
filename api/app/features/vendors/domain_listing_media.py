"""Which photos a vendor's public listing shows, and in what order. Pure.

The listing draws only from the vendor's profile photo and portfolio. By default the
profile photo comes first, then the portfolio in the vendor's order. Staff can reorder
(`listingDisplayOrder`) and hide (`listingHiddenImageUrls`) photos without touching the
vendor's own portfolio order; the first visible photo is the browse-card cover.
"""

from __future__ import annotations

from typing import Any

from app.features.vendors.errors import ListingMediaUrlInvalid


def _url_or_none(value: Any) -> str | None:
    """The trimmed URL, or None for blanks and non-strings."""
    if not isinstance(value, str):
        return None
    return value.strip() or None


def url_list(raw: Any) -> list[str]:
    """The non-blank URLs in `raw`, trimmed, first occurrence order, no repeats."""
    if not isinstance(raw, list):
        return []
    urls: list[str] = []
    for item in raw:
        url = _url_or_none(item)
        if url and url not in urls:
            urls.append(url)
    return urls


def allowed_listing_media_urls(payload: dict[str, Any]) -> set[str]:
    """The profile photo plus every portfolio image: the only photos a listing may show."""
    allowed = set(url_list(payload.get("portfolioFileNames")))
    profile_image = _url_or_none(payload.get("profileImageUrl"))
    if profile_image:
        allowed.add(profile_image)
    return allowed


def default_listing_display_order(payload: dict[str, Any]) -> list[str]:
    """The vendor's default order: profile photo first, then the portfolio."""
    profile_image = _url_or_none(payload.get("profileImageUrl"))
    portfolio = url_list(payload.get("portfolioFileNames"))
    if profile_image:
        return [profile_image, *[url for url in portfolio if url != profile_image]]
    return portfolio


def _stored_or_default_order(payload: dict[str, Any]) -> list[str]:
    """Staff's saved order; else the legacy cover first; else the default order."""
    stored = url_list(payload.get("listingDisplayOrder"))
    if stored:
        return stored
    default_order = default_listing_display_order(payload)
    legacy_cover = _url_or_none(payload.get("listingCoverImageUrl"))
    if legacy_cover:
        return [legacy_cover, *[url for url in default_order if url != legacy_cover]]
    return default_order


def public_listing_image_urls(payload: dict[str, Any]) -> list[str]:
    """The photos the public listing shows, in order: saved order, then any new photos, minus hidden."""
    allowed = allowed_listing_media_urls(payload)
    hidden = set(url_list(payload.get("listingHiddenImageUrls")))
    shown: list[str] = []
    for url in [*_stored_or_default_order(payload), *default_listing_display_order(payload)]:
        if url in allowed and url not in hidden and url not in shown:
            shown.append(url)
    return shown


def listing_cover_image_url(payload: dict[str, Any]) -> str | None:
    """The browse-card cover: the first photo the listing shows."""
    shown = public_listing_image_urls(payload)
    return shown[0] if shown else None


def _checked_urls(urls: list[str], allowed: set[str]) -> list[str]:
    """`urls` trimmed and de-duplicated; raises `ListingMediaUrlInvalid` for a photo not in `allowed`."""
    checked: list[str] = []
    for raw_url in urls:
        url = raw_url.strip()
        if not url or url in checked:
            continue
        if url not in allowed:
            raise ListingMediaUrlInvalid()
        checked.append(url)
    return checked


def with_listing_media(
    payload: dict[str, Any], display_order: list[str], hidden_urls: list[str]
) -> dict[str, Any]:
    """A copy of the form with staff's order and hidden photos applied.

    Nothing is stored when staff send the default order with nothing hidden, so the
    listing keeps following the vendor's own changes. The legacy cover fields go.
    """
    updated = dict(payload)
    allowed = allowed_listing_media_urls(updated)
    hidden = _checked_urls(hidden_urls, allowed)
    order = _checked_urls(display_order, allowed)
    if order and not (order == default_listing_display_order(updated) and not hidden):
        updated["listingDisplayOrder"] = order
    else:
        updated.pop("listingDisplayOrder", None)
    if hidden:
        updated["listingHiddenImageUrls"] = hidden
    else:
        updated.pop("listingHiddenImageUrls", None)
    updated.pop("listingCoverImageUrl", None)
    updated.pop("listingTailImageUrls", None)
    return updated
