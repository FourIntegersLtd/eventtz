"""The pricing slice reproduces the baseline's booking price maths exactly.

Goldens were captured from the baseline `backend/` by `acceptance/capture/referrals_goldens.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.pricing.domain import (
    build_pricing_breakdown,
    format_gbp,
    persisted_total_label,
    resolve_service_fee_percent,
    vendor_portion_gbp,
)

GOLDEN_ROOT = Path(__file__).parent / "pricing"


def load_golden(name: str) -> Any:
    """The recorded cases in `tests/golden/pricing/<name>.json`."""
    return json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", load_golden("money_labels"), ids=lambda case: case["amount"])
def test_money_labels_match_baseline(case: dict[str, str]) -> None:
    """Amounts (recorded as `repr(float)`, including `nan`) get the same GBP labels."""
    assert format_gbp(float(case["amount"])) == case["label"]


@pytest.mark.parametrize("case", load_golden("fee_percent"), ids=lambda case: json.dumps(case["row"]))
def test_fee_percent_matches_baseline(case: dict[str, Any]) -> None:
    """The fee percent read back from a booking row, with the same fallbacks."""
    assert resolve_service_fee_percent(case["row"]) == case["percent"]


@pytest.mark.parametrize("case", load_golden("breakdowns"), ids=lambda case: case["case"]["name"])
def test_breakdowns_match_baseline(case: dict[str, Any]) -> None:
    """Every figure and label of a price, and the stored total label, match the baseline."""
    inputs = {key: value for key, value in case["case"].items() if key != "name"}
    breakdown = build_pricing_breakdown(**inputs)
    assert breakdown.to_dict() == case["breakdown"]
    assert persisted_total_label(breakdown) == case["persisted_total_label"]


@pytest.mark.parametrize(
    "case", load_golden("vendor_portions"), ids=lambda case: json.dumps(case["row"])[:60]
)
def test_vendor_portions_match_baseline(case: dict[str, Any]) -> None:
    """A vendor's portion of a booking row, with and without their adjustments."""
    row = case["row"]
    assert (
        vendor_portion_gbp(row.get("line_items"), row.get("vendor_adjustments")) == case["with_adjustments"]
    )
    assert (
        vendor_portion_gbp(row.get("line_items"), row.get("vendor_adjustments"), include_adjustments=False)
        == case["without_adjustments"]
    )
