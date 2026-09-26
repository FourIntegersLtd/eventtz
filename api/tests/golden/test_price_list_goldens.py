"""The vendors slice reproduces the baseline's list-pricing and package-quality rules exactly.

Goldens were captured from the baseline `backend/` by `acceptance/capture/price_list_goldens.py`.
The baseline raises `ValidationError` for profile-form errors (`validate_package_fields`,
`validate_packages_for_payload`, `raise_if_invalid_single_money_gbp`); the api maps that to
`ProfileInvalid`. For booking line items (`resolve_line_items`), the baseline raises a plain
`ValueError`, and so does the api — see the docstring on `resolve_line_items` in
`app/features/vendors/domain_price_list.py` for why that is kept rather than "fixed".
"""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.features.vendors.domain_packages import (
    count_complete_packages,
    has_vague_package_description,
    is_complete_package,
    is_configured_package,
    package_quality_level,
    validate_package_fields,
    validate_packages_for_payload,
)
from app.features.vendors.domain_price_list import (
    build_pricing_options,
    compute_automatic_discount_lines,
    min_listing_price_gbp,
    parse_money_gbp,
    parse_pricing_mode,
    parse_quantity_input,
    parse_single_money_gbp,
    raise_if_invalid_single_money_gbp,
    reconcile_automatic_discount_lines,
    resolve_line_items,
    validate_single_money_gbp_kind,
)
from app.features.vendors.errors import ProfileInvalid

GOLDEN_ROOT = Path(__file__).parent / "vendors"


def load_golden(name: str) -> Any:
    """The recorded cases in `tests/golden/vendors/<name>.json`."""
    return json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", load_golden("money_gbp"), ids=lambda case: repr(case["raw"]))
def test_money_gbp_matches_baseline(case: dict[str, Any]) -> None:
    """Free-text amounts parse to the same GBP float, or `None`, as the baseline."""
    assert parse_money_gbp(case["raw"]) == case["parsed"]


@pytest.mark.parametrize("case", load_golden("single_money"), ids=lambda case: repr(case["raw"]))
def test_single_money_matches_baseline(case: dict[str, Any]) -> None:
    """A fixed single amount is parsed, validated, and rejected the same way as the baseline."""
    kind = validate_single_money_gbp_kind(case["raw"], required=True)
    assert (kind.value if kind else None) == case["kind"]
    assert parse_single_money_gbp(case["raw"]) == case["parsed"]

    if case["raise_if_invalid"] is None:
        raise_if_invalid_single_money_gbp(case["raw"], "Package price", required=True)
    else:
        with pytest.raises(ProfileInvalid) as raised:
            raise_if_invalid_single_money_gbp(case["raw"], "Package price", required=True)
        assert str(raised.value) == case["raise_if_invalid"]["message"]


@pytest.mark.parametrize("case", load_golden("pricing_mode"), ids=lambda case: case["raw"])
def test_pricing_mode_matches_baseline(case: dict[str, Any]) -> None:
    """Any pricing-mode input resolves to `fixed` or `per_unit` exactly as the baseline does."""
    raw = eval(case["raw"])  # noqa: S307 - trusted golden fixture, not user input
    assert parse_pricing_mode(raw) == case["mode"]


@pytest.mark.parametrize("case", load_golden("quantity_input"), ids=lambda case: case["raw"])
def test_quantity_input_matches_baseline(case: dict[str, Any]) -> None:
    """A quantity field parses to the same `(value, invalid)` pair as the baseline."""
    raw = eval(case["raw"])  # noqa: S307 - trusted golden fixture, not user input
    assert parse_quantity_input(raw) == (case["value"], case["invalid"])


@pytest.mark.parametrize("case", load_golden("pricing_options"), ids=lambda case: case["name"])
def test_pricing_options_match_baseline(case: dict[str, Any]) -> None:
    """The packages/rates built from a profile, and the lowest listing price, match the baseline."""
    options = [asdict(option) for option in build_pricing_options(case["payload"])]
    assert options == case["options"]
    assert min_listing_price_gbp(case["payload"]) == case["min_listing_price_gbp"]


@pytest.mark.parametrize("case", load_golden("line_items"), ids=lambda case: case["name"])
def test_line_items_match_baseline(case: dict[str, Any]) -> None:
    """Booking line items resolve the same way as the baseline, success and every error branch."""
    if case["error"] is None:
        assert (
            resolve_line_items(case["payload"], case["selected_option_ids"], case["quantities"])
            == case["result"]
        )
        return
    with pytest.raises(ValueError) as raised:
        resolve_line_items(case["payload"], case["selected_option_ids"], case["quantities"])
    assert str(raised.value) == case["error"]["message"]


@pytest.mark.parametrize("case", load_golden("auto_discounts"), ids=lambda case: case["name"])
def test_auto_discounts_match_baseline(case: dict[str, Any]) -> None:
    """Automatic bulk/off-peak discount lines, computed and reconciled, match the baseline."""
    event_date = date.fromisoformat(case["event_date"])
    assert (
        compute_automatic_discount_lines(case["payload"], case["line_items"], event_date) == case["computed"]
    )
    assert (
        reconcile_automatic_discount_lines(case["line_items"], case["payload"], event_date)
        == case["reconciled"]
    )


@pytest.mark.parametrize("case", load_golden("package_fields"), ids=lambda case: case["name"])
def test_package_fields_match_baseline(case: dict[str, Any]) -> None:
    """A single package's field validation matches the baseline, success and every error branch."""
    if case["error"] is None:
        validate_package_fields(case["package"], strict=case["strict"])
        return
    with pytest.raises(ProfileInvalid) as raised:
        validate_package_fields(case["package"], strict=case["strict"])
    assert str(raised.value) == case["error"]["message"]


@pytest.mark.parametrize("case", load_golden("packages_payload"), ids=lambda case: case["name"])
def test_packages_payload_matches_baseline(case: dict[str, Any]) -> None:
    """Whole-payload package validation matches the baseline for both `on_submit` states."""
    if case["error"] is None:
        validate_packages_for_payload(
            case["payload"],
            on_submit=case["on_submit"],
            require_service_packages=case["require_service_packages"],
        )
        return
    with pytest.raises(ProfileInvalid) as raised:
        validate_packages_for_payload(
            case["payload"],
            on_submit=case["on_submit"],
            require_service_packages=case["require_service_packages"],
        )
    assert str(raised.value) == case["error"]["message"]


@pytest.mark.parametrize("case", load_golden("package_quality"), ids=lambda case: case["name"])
def test_package_quality_matches_baseline(case: dict[str, Any]) -> None:
    """Completeness counts and the derived quality level match the baseline."""
    assert count_complete_packages(case["payload"]) == (case["complete_count"], case["configured_count"])
    assert package_quality_level(case["payload"]) == case["quality_level"]

    packages = case["payload"].get("packages")
    per_package = []
    if isinstance(packages, list):
        for row in packages:
            if isinstance(row, dict):
                per_package.append(
                    {"configured": is_configured_package(row), "complete": is_complete_package(row)},
                )
    assert per_package == case["per_package"]


@pytest.mark.parametrize("case", load_golden("vague_descriptions"), ids=lambda case: repr(case["details"]))
def test_vague_descriptions_match_baseline(case: dict[str, Any]) -> None:
    """Placeholder-looking package descriptions are flagged the same way as the baseline."""
    assert has_vague_package_description(case["details"]) == case["vague"]
