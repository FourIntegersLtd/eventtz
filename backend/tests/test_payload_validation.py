"""Tests for vendor profile payload validation."""

from __future__ import annotations

import pytest

from app.core.errors import ValidationError
from app.features.vendors.payload_validation import (
    normalize_payload_fields,
    validate_payload_for_progress,
    validate_step_fields,
)


def test_normalize_clamps_discount_on_same_step_save():
    payload = {"offerDiscounts": True, "discountPercentage": "150"}
    out = normalize_payload_fields(payload, "user-1")
    assert out["discountPercentage"] == "100"


def test_validate_step_4_rejects_high_discount():
    payload = {
        "packages": [{"title": "Gold", "price": "500"}],
        "offerDiscounts": True,
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
        "packages": [{"title": "Gold", "price": "500"}],
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
        "packages": [{"title": "Gold", "price": "500"}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
        "offerDiscounts": True,
        "discountPercentage": "200",
    }
    with pytest.raises(ValidationError, match="0 and 100"):
        validate_payload_for_progress(
            current_step=6,
            previous_step=4,
            payload=payload,
            status="draft",
        )


def test_submit_rejects_invalid_discount():
    payload = {
        "businessName": "Biz",
        "baseCity": "London",
        "servicesOffered": ["catering"],
        "packages": [{"title": "Gold", "price": "500"}],
        "availableWeekdays": ["Mon"],
        "maxBookingsPerDay": "2",
        "portfolioFileNames": ["a", "b", "c", "d", "e"],
        "offerDiscounts": True,
        "discountPercentage": "200",
    }
    with pytest.raises(ValidationError):
        validate_payload_for_progress(
            current_step=9,
            previous_step=8,
            payload=payload,
            status="submitted",
        )


def test_validate_step_6_allows_empty_portfolio():
    validate_step_fields(6, {"portfolioFileNames": []})
    validate_step_fields(6, {})


def test_validate_step_6_rejects_over_cap():
    payload = {"portfolioFileNames": [f"img-{i}" for i in range(21)]}
    with pytest.raises(ValidationError, match="maximum 20"):
        validate_step_fields(6, payload)


def test_normalize_strips_external_portfolio_url():
    payload = {
        "portfolioFileNames": [
            "https://evil.com/photo.jpg",
            "https://x.supabase.co/storage/v1/object/public/eventtz-images/users/u1/a.jpg",
        ],
    }
    out = normalize_payload_fields(payload, "u1")
    assert len(out["portfolioFileNames"]) == 1
    assert "users/u1/" in out["portfolioFileNames"][0]
