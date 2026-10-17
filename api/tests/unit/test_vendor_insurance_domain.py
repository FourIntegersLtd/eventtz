"""Public liability insurance rules (`vendors/domain_insurance.py`): optional, checked by staff."""

from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.features.vendors.domain_insurance import has_valid_insurance, insurance_status
from app.features.vendors.domain_profile_form import validate_payload_for_progress

TODAY = date(2027, 3, 1)
CERTIFICATE = "https://cdn.example.com/users/vendor/insurance.pdf"
# The recorded onboarding cases; "submit complete" passes every submit check.
PROFILE_PROGRESS = Path(__file__).parents[1] / "golden" / "vendors" / "profile_progress.json"


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


def _complete_submission(services: list[str], certificate: str) -> dict[str, Any]:
    """The golden "submit complete" profile with its services and certificate replaced."""
    cases = json.loads(PROFILE_PROGRESS.read_text(encoding="utf-8"))
    case = next(case for case in cases if case["name"] == "submit complete")
    return {
        **copy.deepcopy(case["payload"]),
        "servicesOffered": services,
        "indemnityCertNamePersisted": certificate,
    }


@pytest.mark.parametrize("services", [["catering"], ["baking"], ["photography"]])
def test_any_vendor_submits_without_a_certificate(services: list[str]) -> None:
    """Insurance is optional for now, caterers and bakers included."""
    validate_payload_for_progress(
        current_step=8, previous_step=8, payload=_complete_submission(services, ""), status="submitted"
    )
