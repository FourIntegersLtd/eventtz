"""Public liability insurance rules for higher-risk vendors (`vendors/domain_insurance.py`)."""

from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.features.vendors.domain_insurance import (
    has_valid_insurance,
    insurance_allows_listing,
    insurance_status,
    requires_insurance,
)
from app.features.vendors.domain_profile_form import (
    STEP_DOCUMENTS_INSURANCE_REQUIRED,
    validate_payload_for_progress,
)
from app.features.vendors.domain_visibility import is_publicly_listable
from app.features.vendors.errors import ProfileInvalid

TODAY = date(2027, 3, 1)
CERTIFICATE = "https://cdn.example.com/users/vendor/insurance.pdf"
# The recorded onboarding cases; "submit complete" passes every submit check.
PROFILE_PROGRESS = Path(__file__).parents[1] / "golden" / "vendors" / "profile_progress.json"


@pytest.mark.parametrize(
    ("services", "expected"),
    [
        (["catering"], True),
        (["photography", "Baking "], True),
        (["baking"], True),
        (["rentals", "decor", "dj"], False),
        (["photography", "makeup", "mc", "hair_styling", "event_planning"], False),
        ([], False),
        (None, False),
    ],
)
def test_only_food_services_need_insurance(services: list[str] | None, expected: bool) -> None:
    """Any one higher-risk service is enough; keys are compared trimmed and lower-cased."""
    assert requires_insurance(services) is expected


def test_status_reads_each_stage_of_a_certificate() -> None:
    """Nothing, an unchecked upload, in date, ending within 30 days, and ended."""
    assert (
        insurance_status(certificate_url=None, verified_certificate_url=None, expires_on=None, today=TODAY)
        == "missing"
    )
    assert (
        insurance_status(
            certificate_url=CERTIFICATE, verified_certificate_url=None, expires_on=None, today=TODAY
        )
        == "awaiting_check"
    )
    checked = {"certificate_url": CERTIFICATE, "verified_certificate_url": CERTIFICATE, "today": TODAY}
    assert insurance_status(**checked, expires_on=date(2027, 6, 1)) == "verified"
    assert insurance_status(**checked, expires_on=date(2027, 3, 31)) == "expiring"
    assert insurance_status(**checked, expires_on=date(2027, 3, 1)) == "expiring"
    assert insurance_status(**checked, expires_on=date(2027, 2, 28)) == "expired"


def test_a_renewal_upload_awaits_a_check_while_the_old_cover_still_runs() -> None:
    """A different file from the one staff checked needs checking, whatever the old expiry."""
    status = insurance_status(
        certificate_url="https://cdn.example.com/users/vendor/renewal.pdf",
        verified_certificate_url=CERTIFICATE,
        expires_on=date(2027, 6, 1),
        today=TODAY,
    )
    assert status == "awaiting_check"


def test_valid_insurance_runs_to_the_end_of_its_last_day() -> None:
    """The expiry day itself still counts; nothing checked never counts."""
    assert has_valid_insurance(date(2027, 3, 1), today=TODAY) is True
    assert has_valid_insurance(date(2027, 2, 28), today=TODAY) is False
    assert has_valid_insurance(None, today=TODAY) is False


def test_lapsed_cover_keeps_the_listing_for_14_days() -> None:
    """Listed through expiry + 14 days, hidden the day after."""
    assert insurance_allows_listing(required=True, expires_on=date(2027, 2, 15), today=TODAY) is True
    assert insurance_allows_listing(required=True, expires_on=date(2027, 2, 14), today=TODAY) is False


def test_unchecked_vendors_stay_listed_only_until_the_rule_starts() -> None:
    """No checked cover: listed on 30 November 2026, hidden from 1 December 2026."""
    assert insurance_allows_listing(required=True, expires_on=None, today=date(2026, 11, 30)) is True
    assert insurance_allows_listing(required=True, expires_on=None, today=date(2026, 12, 1)) is False


def test_vendors_who_need_no_cover_are_never_hidden_for_it() -> None:
    """A photographer with nothing checked stays listed."""
    assert insurance_allows_listing(required=False, expires_on=None, today=TODAY) is True


def test_missing_insurance_hides_even_a_listing_forced_visible() -> None:
    """The visible override waives Stripe, not insurance."""
    listed = {"approval_status": "approved", "listing_override": "visible", "payouts_ready": False}
    assert is_publicly_listable(**listed) is True
    assert is_publicly_listable(**listed, insurance_ok=False) is False


def _complete_submission(services: list[str], certificate: str) -> dict[str, Any]:
    """The golden "submit complete" profile with its services and certificate replaced."""
    cases = json.loads(PROFILE_PROGRESS.read_text(encoding="utf-8"))
    case = next(case for case in cases if case["name"] == "submit complete")
    return {
        **copy.deepcopy(case["payload"]),
        "servicesOffered": services,
        "indemnityCertNamePersisted": certificate,
    }


def _submit(payload: dict[str, Any]) -> None:
    """Submit the profile from the last step, as the form does."""
    validate_payload_for_progress(current_step=8, previous_step=8, payload=payload, status="submitted")


def test_submitting_a_catering_profile_without_a_certificate_names_the_fix() -> None:
    """Higher-risk services need a certificate on submit; others still submit without one."""
    with pytest.raises(ProfileInvalid) as raised:
        _submit(_complete_submission(["catering"], ""))
    assert str(raised.value.message) == STEP_DOCUMENTS_INSURANCE_REQUIRED

    _submit(_complete_submission(["catering"], CERTIFICATE))
    _submit(_complete_submission(["photography"], ""))
