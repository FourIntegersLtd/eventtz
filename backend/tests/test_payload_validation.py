"""Tests for vendor profile payload validation."""

from __future__ import annotations

import pytest

from app.core.errors import ValidationError
from app.features.vendors.taxonomy import VENDOR_SERVICE_KEYS, filter_service_keys
from app.features.vendors.profile_form_validation import (
    normalize_payload_fields,
    validate_payload_for_progress,
    validate_step_fields,
)

PACKAGE_DETAILS = (
    "Full wedding coverage with edited digital gallery and online sharing for clients."
)


def test_normalize_clamps_discount_on_same_step_save():
    payload = {"offerDiscounts": True, "discountPercentage": "150"}
    out = normalize_payload_fields(payload, "user-1")
    assert out["discountPercentage"] == "100"


def test_validate_step_4_rejects_high_discount():
    payload = {
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "offerDiscounts": True,
        "discountLabel": "Summer sale",
        "discountPercentage": "150",
    }
    with pytest.raises(ValidationError, match="0 and 100"):
        validate_step_fields(4, payload)


def test_validate_step_5_rejects_max_bookings_over_cap():
    payload = {"availableWeekdays": ["Mon"], "maxBookingsPerDay": "25"}
    with pytest.raises(ValidationError, match="max bookings"):
        validate_step_fields(5, payload)


def test_validate_payload_for_progress_on_advance():
    payload = {
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
    }
    validate_payload_for_progress(
        current_step=5,
        previous_step=4,
        payload=payload,
        status="draft",
    )


def test_multi_step_advance_validates_skipped_steps():
    payload = {
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
        "offerDiscounts": True,
        "discountLabel": "Summer sale",
        "discountPercentage": "200",
    }
    with pytest.raises(ValidationError, match="0 and 100"):
        validate_payload_for_progress(
            current_step=6,
            previous_step=4,
            payload=payload,
            status="draft",
        )


def test_filter_service_keys_accepts_new_categories():
    assert filter_service_keys(
        ["dj", "mc", "decor", "event_planning", "hair_styling"],
    ) == ["dj", "mc", "decor", "event_planning", "hair_styling"]


def test_filter_service_keys_rejects_unknown():
    assert filter_service_keys(["catering", "not_a_real_type", "dj"]) == ["catering", "dj"]


def test_vendor_service_keys_include_new_categories():
    assert VENDOR_SERVICE_KEYS == frozenset(
        {
            "baking",
            "catering",
            "photography",
            "makeup",
            "rentals",
            "event_planning",
            "decor",
            "dj",
            "mc",
            "hair_styling",
        },
    )


def test_submit_rejects_invalid_service():
    payload = {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "phone": "07123456789",
        "businessName": "Biz",
        "baseCity": "London",
        "countryCode": "GB",
        "deliveryModes": ["delivery"],
        "travelRadius": "under_50",
        "travelDeliveryPolicy": "fee_included",
        "servicesOffered": ["not_a_real_type"],
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
        "profileImageUrl": "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/p.jpg",
    }
    with pytest.raises(ValidationError, match="valid service"):
        validate_payload_for_progress(
            current_step=9,
            previous_step=8,
            payload=payload,
            status="submitted",
        )


def test_submit_rejects_invalid_discount():
    payload = {
        "businessName": "Biz",
        "baseCity": "London",
        "servicesOffered": ["photography"],
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
        "profileImageUrl": "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/p.jpg",
        "offerDiscounts": True,
        "discountLabel": "Summer sale",
        "discountPercentage": "200",
    }
    with pytest.raises(ValidationError):
        validate_payload_for_progress(
            current_step=9,
            previous_step=8,
            payload=payload,
            status="submitted",
        )


def test_validate_step_6_rejects_under_minimum():
    with pytest.raises(ValidationError, match="at least 5"):
        validate_step_fields(6, {"portfolioFileNames": []})
    with pytest.raises(ValidationError, match="at least 5"):
        validate_step_fields(6, {"portfolioFileNames": ["a", "b", "c", "d"]})
    validate_step_fields(6, {"portfolioFileNames": ["a", "b", "c", "d", "e"]})


def test_validate_step_6_rejects_over_cap():
    payload = {"portfolioFileNames": [f"img-{i}" for i in range(21)]}
    with pytest.raises(ValidationError, match="maximum 20"):
        validate_step_fields(6, payload)


def test_validate_step_1_requires_valid_phone():
    with pytest.raises(ValidationError, match="phone number is required"):
        validate_step_fields(1, {"firstName": "Ada", "lastName": "Lovelace", "phone": ""})
    with pytest.raises(ValidationError, match="valid phone number"):
        validate_step_fields(
            1,
            {"firstName": "Ada", "lastName": "Lovelace", "phone": "not-a-phone"},
        )
    validate_step_fields(
        1,
        {"firstName": "Ada", "lastName": "Lovelace", "phone": "07123456789"},
    )


def test_validate_payload_for_progress_step_1():
    with pytest.raises(ValidationError, match="valid phone number"):
        validate_payload_for_progress(
            current_step=2,
            previous_step=1,
            payload={"firstName": "Ada", "lastName": "Lovelace", "phone": "123"},
            status="draft",
        )


def test_validate_step_4_rejects_zero_price():
    payload = {
        "hourlyRate": "0",
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
    }
    with pytest.raises(ValidationError, match="at least"):
        validate_step_fields(4, payload)


def test_validate_step_4_rejects_comma_separated_package_price():
    payload = {
        "packages": [{"title": "Chairs", "price": "150, 180", "details": PACKAGE_DETAILS}],
    }
    with pytest.raises(ValidationError, match="one amount only"):
        validate_step_fields(4, payload)


def test_validate_step_4_requires_discount_option_when_enabled():
    payload = {
        "packages": [{"title": "Gold", "price": "500", "details": PACKAGE_DETAILS}],
        "offerDiscounts": True,
        "discountLabel": "Summer sale",
    }
    with pytest.raises(ValidationError, match="at least one discount"):
        validate_step_fields(4, payload)


def test_validate_step_4_rejects_short_package_details():
    payload = {
        "packages": [{"title": "Gold", "price": "500", "details": "Too short"}],
    }
    with pytest.raises(ValidationError, match="what's included"):
        validate_step_fields(4, payload)


def test_normalize_strips_external_portfolio_url(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.features.media.s3.get_settings",
        lambda: SimpleNamespace(aws_s3_bucket_name="eventtz", aws_region="eu-west-2"),
    )
    payload = {
        "portfolioFileNames": [
            "https://evil.com/photo.jpg",
            "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
        ],
    }
    out = normalize_payload_fields(payload, "u1")
    assert len(out["portfolioFileNames"]) == 1
    assert "users/u1/" in out["portfolioFileNames"][0]


def test_normalize_keeps_s3_urls(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(
        "app.features.media.s3.get_settings",
        lambda: SimpleNamespace(aws_s3_bucket_name="eventtz", aws_region="eu-west-2"),
    )
    s3 = "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/b.jpg"
    out = normalize_payload_fields({"portfolioFileNames": [s3, "https://evil.com/x.jpg"]}, "u1")
    assert out["portfolioFileNames"] == [s3]
