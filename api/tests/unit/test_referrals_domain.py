"""Referral and pricing rules the goldens do not reach: unique slugs, links, random codes and ids."""

from __future__ import annotations

import uuid

from app.features.identity.domain import client_display_name
from app.features.pricing.domain import build_pricing_breakdown, normalise_vendor_adjustments
from app.features.referrals.domain import (
    client_share_link,
    first_free_slug,
    looks_like_uuid,
    normalise_client_code,
    partner_register_link,
    random_client_code,
    slug_base,
)


def test_first_free_slug_counts_up_from_two() -> None:
    """A taken slug gets `-2`, then `-3`; gaps are reused."""
    assert first_free_slug("sunny", set()) == "sunny"
    assert first_free_slug("sunny", {"sunny"}) == "sunny-2"
    assert first_free_slug("sunny", {"sunny", "sunny-2", "sunny-4"}) == "sunny-3"


def test_slug_base_prefers_the_chosen_slug_and_falls_back_to_the_name() -> None:
    """A blank chosen slug means "make one from the display name"."""
    assert slug_base(display_name="Sunny Cakes", chosen_slug="Café X!!") == "cafe-x"
    assert slug_base(display_name="Sunny Cakes", chosen_slug="   ") == "sunny-cakes"
    assert slug_base(display_name="Sunny Cakes", chosen_slug=None) == "sunny-cakes"


def test_links_point_at_the_public_website() -> None:
    """Partner and client links are absolute links on www.eventtz.com."""
    assert partner_register_link("sunny") == "https://www.eventtz.com/vendor/register?ref=sunny"
    assert (
        client_share_link(" vendor-1 ", "123456")
        == "https://www.eventtz.com/client/browse/vendor-1?vref=123456"
    )


def test_random_codes_are_six_ascii_digits_that_survive_normalising() -> None:
    """Generated codes keep leading zeros and are always valid codes."""
    for _attempt in range(200):
        code = random_client_code()
        assert len(code) == 6 and code.isascii() and code.isdigit()
        assert normalise_client_code(code) == code


def test_looks_like_uuid() -> None:
    """Ids from the URL are checked before they reach a uuid column."""
    assert looks_like_uuid(str(uuid.uuid4()))
    assert not looks_like_uuid("not-a-uuid")


def test_short_adjustment_ids_get_a_fresh_uuid() -> None:
    """Ids under eight characters are replaced; longer ids are kept."""
    short, kept = normalise_vendor_adjustments(
        [{"id": "abc", "amount_gbp": 5}, {"id": "adjustment-01", "amount_gbp": 6}]
    )
    assert looks_like_uuid(short.id)
    assert kept.id == "adjustment-01"


def test_referral_discount_never_exceeds_the_fee() -> None:
    """A £15 discount on a £5 fee takes the fee to zero, not below."""
    breakdown = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": 100}], vendor_adjustments=[], referral_fee_discount_gbp=15
    )
    assert breakdown.referral_fee_discount_gbp == 5.0
    assert breakdown.service_fee_gbp == 0.0
    assert breakdown.client_total_gbp == 100.0


def test_client_display_name_order() -> None:
    """Deleted beats everything; then preferred name; then the email; then "Client"."""
    assert client_display_name(email="jane@x.com", preferred_name="J", deleted=True) == "Deleted user"
    assert client_display_name(email="jane@x.com", preferred_name="  Janey ", deleted=False) == "Janey"
    assert client_display_name(email="jane.doe@x.com", preferred_name="  ", deleted=False) == "Jane Doe"
    assert client_display_name(email="123@x.com", preferred_name=None, deleted=False) == "Client"
