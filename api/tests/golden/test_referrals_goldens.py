"""The referrals slice reproduces the baseline's slug, code, tier, discount and client-name rules.

Goldens were captured from the baseline `backend/` by `acceptance/capture/referrals_goldens.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.identity.domain import friendly_name_from_email
from app.features.referrals.domain import (
    discount_for_spend,
    is_valid_slug,
    normalise_client_code,
    normalise_slug,
    stored_code_discount,
    tier_min_spend,
)

GOLDEN_ROOT = Path(__file__).parent / "referrals"
# Which vendor owned each code when the stored-discount goldens were captured.
CODE_OWNERS = {"111111": "vendor-a", "222222": "vendor-b"}


def load_golden(name: str) -> Any:
    """The recorded cases in `tests/golden/referrals/<name>.json`."""
    return json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", load_golden("slugs"), ids=lambda case: case["raw"] or "<empty>")
def test_slugs_match_baseline(case: dict[str, Any]) -> None:
    """Typed slugs clean up, and pass or fail validation, the same way."""
    normalised = normalise_slug(case["raw"])
    assert normalised == case["normalised"]
    assert is_valid_slug(normalised) == case["valid"]


@pytest.mark.parametrize("case", load_golden("client_codes"), ids=lambda case: repr(case["raw"]))
def test_client_codes_match_baseline(case: dict[str, Any]) -> None:
    """Typed client codes reduce to the same digits (or to nothing)."""
    assert normalise_client_code(case["raw"]) == case["normalised"]


@pytest.mark.parametrize("case", load_golden("fee_tiers"), ids=lambda case: str(case["spend"]))
def test_fee_tiers_match_baseline(case: dict[str, Any]) -> None:
    """Each spend earns the same discount and reaches the same tier."""
    assert discount_for_spend(case["spend"]) == case["discount"]
    assert tier_min_spend(case["spend"]) == case["tier_min_spend"]


@pytest.mark.parametrize(
    "case", load_golden("stored_discounts"), ids=lambda case: f"{json.dumps(case['row'])}|{case['spend']}"
)
def test_stored_discounts_match_baseline(case: dict[str, Any]) -> None:
    """A code stored on a booking earns the same discount, including when a rival vendor owns it."""
    row = case["row"]
    discount, tier_min = stored_code_discount(
        stored_code=row.get("vendor_referral_code"),
        booking_vendor_id=row.get("vendor_user_id"),
        code_owners=CODE_OWNERS,
        vendor_portion_gbp=case["spend"],
    )
    assert (discount, tier_min) == (case["discount"], case["tier_min_spend"])


@pytest.mark.parametrize("case", load_golden("client_names"), ids=lambda case: repr(case["email"]))
def test_client_names_match_baseline(case: dict[str, Any]) -> None:
    """Emails turn into the same friendly client names (or none)."""
    assert friendly_name_from_email(case["email"]) == case["friendly_name"]
