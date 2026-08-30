"""Tests for vendor listing media resolution and persistence helpers."""

from __future__ import annotations

import pytest

from app.features.vendors.listing_media import (
    default_listing_display_order,
    listing_cover_image_url_from_payload,
    public_listing_image_urls_from_payload,
    update_vendor_listing_media,
)


def _payload(
    *,
    profile: str | None = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/profile.jpg",
    portfolio: list[str] | None = None,
    display_order: list[str] | None = None,
    hidden: list[str] | None = None,
    legacy_cover: str | None = None,
) -> dict:
    portfolio = portfolio or [
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg",
    ]
    payload: dict = {"profileImageUrl": profile or "", "portfolioFileNames": portfolio}
    if display_order is not None:
        payload["listingDisplayOrder"] = display_order
    if hidden is not None:
        payload["listingHiddenImageUrls"] = hidden
    if legacy_cover is not None:
        payload["listingCoverImageUrl"] = legacy_cover
    return payload


def test_default_order_puts_profile_first():
    payload = _payload()
    assert default_listing_display_order(payload)[0] == payload["profileImageUrl"]


def test_public_order_uses_display_order():
    profile = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/profile.jpg"
    portfolio = [
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg",
    ]
    payload = _payload(
        profile=profile,
        portfolio=portfolio,
        display_order=[portfolio[1], portfolio[0], profile],
    )
    urls = public_listing_image_urls_from_payload(payload)
    assert urls[0] == portfolio[1]
    assert listing_cover_image_url_from_payload(payload) == portfolio[1]


def test_hidden_urls_removed_from_public_order():
    portfolio = [
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg",
    ]
    profile = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/profile.jpg"
    payload = _payload(profile=profile, portfolio=portfolio, hidden=[profile])
    urls = public_listing_image_urls_from_payload(payload)
    assert profile not in urls
    assert urls[0] == portfolio[0]


def test_legacy_cover_moves_url_to_front_when_no_display_order():
    portfolio = [
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg",
    ]
    payload = _payload(portfolio=portfolio, legacy_cover=portfolio[1])
    assert listing_cover_image_url_from_payload(payload) == portfolio[1]


def test_update_vendor_listing_media_rejects_unknown_url(monkeypatch):
    monkeypatch.setattr(
        "app.features.vendors.listing_media.get_vendor_profile",
        lambda user_id: {"payload": _payload()},
    )
    monkeypatch.setattr(
        "app.features.vendors.listing_media.get_db",
        lambda: pytest.fail("db should not be called"),
    )

    with pytest.raises(ValueError, match="portfolio"):
        update_vendor_listing_media(
            "u1",
            display_order=["https://evil.com/x.jpg"],
            hidden_image_urls=[],
        )
