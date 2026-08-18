"""Tests for vendor package quality rules."""

from __future__ import annotations

import pytest

from app.core.errors import ValidationError
from app.features.vendors.package_quality import (
    has_vague_package_description,
    is_complete_package,
    is_configured_package,
    package_quality_level,
    validate_packages_for_payload,
)


def _complete_pkg(**overrides):
    base = {
        "title": "Small Chops Pack",
        "price": "40",
        "details": "10 spring rolls, 10 samosas, 10 puff-puff and 5 peppered gizzard.",
    }
    base.update(overrides)
    return base


def test_is_complete_package_requires_description():
    assert is_complete_package(_complete_pkg())
    assert not is_complete_package(_complete_pkg(details=""))
    assert is_complete_package(_complete_pkg(title="Package 1"))


def test_vague_description_helper_optional():
    assert has_vague_package_description("Contact for details about what's included")
    assert not has_vague_package_description("10 samosas and 10 spring rolls included.")


def test_validate_packages_for_submit_requires_profile_photo():
    payload = {
        "servicesOffered": ["photography"],
        "packages": [_complete_pkg()],
        "profileImageUrl": "",
    }
    with pytest.raises(ValidationError, match="profile photo"):
        validate_packages_for_payload(payload, on_submit=True)


def test_catering_requires_complete_package_on_step():
    payload = {
        "servicesOffered": ["catering"],
        "packages": [{"title": "Chops", "price": "40", "details": "short"}],
    }
    with pytest.raises(ValidationError, match="what's included"):
        validate_packages_for_payload(payload, require_service_packages=True)


def test_hair_styling_requires_complete_package_on_step():
    payload = {
        "servicesOffered": ["hair_styling"],
        "packages": [{"title": "Bridal hair", "price": "200", "details": "short"}],
    }
    with pytest.raises(ValidationError, match="what's included"):
        validate_packages_for_payload(payload, require_service_packages=True)


def test_dj_does_not_require_package_on_step():
    payload = {
        "servicesOffered": ["dj"],
        "packages": [],
        "hourlyRate": "150",
    }
    validate_packages_for_payload(payload, require_service_packages=True)


def test_package_quality_level():
    payload = {"packages": [_complete_pkg(), _complete_pkg(title="Large Pack", price="70")]}
    assert package_quality_level(payload) == "high"
    payload_incomplete = {
        "packages": [_complete_pkg(), {"title": "X", "price": "10", "details": ""}],
    }
    assert package_quality_level(payload_incomplete) == "needs_review"


def test_group_flat_tips_merges_by_package():
    from app.features.vendors.onboarding_ai import _group_flat_tips

    tips = [
        {"package_id": "1", "package_title": "Gold package", "message": "Add guest capacity."},
        {"package_id": "1", "package_title": "Gold package", "message": "Clarify duration."},
        {"package_id": "2", "package_title": "Silver Package", "message": "Rename the package."},
    ]
    grouped = _group_flat_tips(tips)
    assert len(grouped) == 2
    assert len(grouped[0]["items"]) == 2
    assert grouped[0]["package_title"] == "Gold package"


def test_filter_weak_package_suggestions_drops_short_or_similar():
    from app.features.vendors.onboarding_ai import _filter_weak_package_suggestions

    packages = [
        {
            "id": "p1",
            "title": "Gold package",
            "details": "Chairs and tables for events with delivery.",
            "duration": "",
        },
    ]
    feedback = [
        {
            "package_id": "p1",
            "package_title": "Gold package",
            "items": [],
            "suggested_title": "Chairs",
            "suggested_details": "Chairs and tables for events with delivery included.",
            "suggested_duration": None,
        },
        {
            "package_id": "p1",
            "package_title": "Gold package",
            "items": [],
            "suggested_title": "Chair Hire – 50 pack",
            "suggested_details": "50 white folding chairs, 3-day hire, delivery and collection within 10 miles.",
            "suggested_duration": "3-day hire",
        },
    ]
    filtered = _filter_weak_package_suggestions(feedback, packages)
    assert len(filtered) == 1
    assert filtered[0]["suggested_title"] == "Chair Hire – 50 pack"
    assert "50 white folding chairs" in (filtered[0]["suggested_details"] or "")
