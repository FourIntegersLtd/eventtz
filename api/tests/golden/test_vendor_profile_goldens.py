"""The vendors slice tidies and checks the onboarding form, and decides listing visibility, like the baseline.

Goldens were captured from the baseline `backend/` by `acceptance/capture/vendor_profile_goldens.py`.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.features.vendors.domain_listing_media import (
    default_listing_display_order,
    listing_cover_image_url,
    public_listing_image_urls,
    url_list,
    with_listing_media,
)
from app.features.vendors.domain_profile_form import (
    business_name_from_payload,
    clamp_bio_words,
    explore_search_patch_from_payload,
    is_valid_phone_number,
    normalize_business_name,
    normalize_payload_fields,
    validate_payload_for_progress,
    validate_step_fields,
)
from app.features.vendors.domain_visibility import is_publicly_listable, listing_override_of, payouts_verified
from app.features.vendors.errors import ListingMediaUrlInvalid, ProfileInvalid

GOLDEN_ROOT = Path(__file__).parent / "vendors"


def load_golden(name: str) -> Any:
    """The recorded cases in `tests/golden/vendors/<name>.json`."""
    return json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))


def outcome(check: Callable[[], None]) -> str:
    """Run a check: "ok", or the `ProfileInvalid` message it raised."""
    try:
        check()
    except ProfileInvalid as error:
        return error.message
    return "ok"


NORMALIZE = load_golden("profile_normalize")


@pytest.mark.parametrize("case", NORMALIZE["cases"], ids=lambda case: case["name"])
def test_saves_tidy_the_form_like_baseline(case: dict[str, Any]) -> None:
    """Numbers are clamped and foreign upload URLs dropped exactly as before."""
    normalized = normalize_payload_fields(
        copy.deepcopy(case["payload"]), NORMALIZE["user_id"], upload_host=NORMALIZE["upload_host"]
    )
    assert normalized == case["normalized"]


@pytest.mark.parametrize("case", load_golden("profile_steps"), ids=lambda case: case["name"])
def test_each_step_check_matches_baseline(case: dict[str, Any]) -> None:
    """Every step passes or fails with the same message."""
    results = {
        str(step): outcome(lambda step=step: validate_step_fields(step, copy.deepcopy(case["payload"])))  # type: ignore[misc]
        for step in range(1, 9)
    }
    assert results == case["steps"]


@pytest.mark.parametrize("case", load_golden("profile_progress"), ids=lambda case: case["name"])
def test_moving_on_and_submitting_match_baseline(case: dict[str, Any]) -> None:
    """Forward moves check the finished steps; submit checks everything and narrows the services."""
    payload = copy.deepcopy(case["payload"])
    result = outcome(
        lambda: validate_payload_for_progress(
            current_step=case["current"],
            previous_step=case["previous"],
            payload=payload,
            status=case["status"],
        )
    )
    assert result == case["result"]
    assert payload.get("servicesOffered") == case["services_after"]


@pytest.mark.parametrize("case", load_golden("phones"), ids=lambda case: repr(case["phone"]))
def test_phone_numbers_match_baseline(case: dict[str, Any]) -> None:
    """UK and international numbers pass or fail the same way."""
    assert is_valid_phone_number(case["phone"]) == case["valid"]


@pytest.mark.parametrize("case", load_golden("business_names"), ids=lambda case: repr(case["name"]))
def test_business_names_normalise_like_baseline(case: dict[str, Any]) -> None:
    """Business names compare the same way (case, spaces)."""
    assert normalize_business_name(case["name"]) == case["normalized"]
    assert business_name_from_payload({"businessName": case["name"]}) == case["from_payload"]


@pytest.mark.parametrize("case", load_golden("bios"), ids=lambda case: case["bio"][:20] or "<empty>")
def test_bios_clamp_like_baseline(case: dict[str, Any]) -> None:
    """Long bios are cut to 100 words with an ellipsis."""
    assert clamp_bio_words(case["bio"]) == case["clamped"]


@pytest.mark.parametrize("case", load_golden("explore_patches"), ids=lambda case: str(len(case["payload"])))
def test_search_columns_match_baseline(case: dict[str, Any]) -> None:
    """The explore search columns derived from the form are the same."""
    assert explore_search_patch_from_payload(case["payload"]) == case["patch"]


@pytest.mark.parametrize("case", load_golden("visibility"), ids=lambda case: json.dumps(case["row"]))
def test_visibility_matches_baseline(case: dict[str, Any]) -> None:
    """Approval, Stripe readiness and the admin override decide listing the same way."""
    row = case["row"]
    ready = payouts_verified(
        stripe_account_id=row.get("stripe_account_id"),
        charges_enabled=bool(row.get("stripe_charges_enabled")),
        payouts_enabled=bool(row.get("stripe_payouts_enabled")),
    )
    assert listing_override_of(row.get("listing_override")) == case["override"]
    assert ready == case["payouts_verified"]
    assert (
        is_publicly_listable(
            approval_status=row.get("approval_status"),
            listing_override=row.get("listing_override"),
            payouts_ready=ready,
        )
        == case["listable"]
    )


LISTING_MEDIA = load_golden("listing_media")


@pytest.mark.parametrize("case", LISTING_MEDIA["public"], ids=lambda case: case["name"])
def test_public_listing_photos_match_baseline(case: dict[str, Any]) -> None:
    """The public photo order, cover and the admin state view are the same."""
    payload = case["payload"]
    assert public_listing_image_urls(payload) == case["urls"]
    assert listing_cover_image_url(payload) == case["cover"]
    assert default_listing_display_order(payload) == case["default_order"]
    assert {
        "listing_cover_image_url": listing_cover_image_url(payload),
        "display_order": url_list(payload.get("listingDisplayOrder")),
        "hidden_image_urls": url_list(payload.get("listingHiddenImageUrls")),
    } == case["state"]


@pytest.mark.parametrize("case", LISTING_MEDIA["updates"], ids=lambda case: case["name"])
def test_admin_listing_photo_changes_match_baseline(case: dict[str, Any]) -> None:
    """Staff reorder and hide photos with the same stored result, or the same refusal."""
    try:
        updated = with_listing_media(copy.deepcopy(case["base"]), case["order"], case["hidden"])
    except ListingMediaUrlInvalid as error:
        assert error.message == case["error"]
        return
    saved = normalize_payload_fields(updated, NORMALIZE["user_id"], upload_host=NORMALIZE["upload_host"])
    assert saved == case["payload"]
