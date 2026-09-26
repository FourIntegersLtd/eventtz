"""Capture the vendor list-pricing and package-quality goldens from the baseline.

Run with `make capture SCRIPT=capture/price_list_goldens.py` (never directly). Output goes to
`vendors/` under the golden directory:

- `vendors/money_gbp.json`: free-text amount parsing (`parse_money_gbp`).
- `vendors/single_money.json`: single fixed-amount parsing and validation
  (`parse_single_money_gbp`, `validate_single_money_gbp_kind`, `raise_if_invalid_single_money_gbp`).
- `vendors/pricing_mode.json`: pricing-mode parsing (`parse_pricing_mode`).
- `vendors/quantity_input.json`: quantity parsing (`parse_quantity_input`).
- `vendors/pricing_options.json`: packages and rates built from a profile payload
  (`build_pricing_options`), plus the lowest listing price for the same payloads
  (`min_listing_price_gbp`).
- `vendors/line_items.json`: booking line items resolved from a selection
  (`resolve_line_items`), success and every error branch.
- `vendors/auto_discounts.json`: automatic bulk/off-peak discount lines
  (`compute_automatic_discount_lines`, `reconcile_automatic_discount_lines`).
- `vendors/package_fields.json`: single-package field validation
  (`validate_package_fields`), strict and non-strict.
- `vendors/packages_payload.json`: whole-payload package validation
  (`validate_packages_for_payload`), `on_submit` true and false.
- `vendors/package_quality.json`: completeness counting and quality level
  (`count_complete_packages`, `package_quality_level`, `is_complete_package`,
  `is_configured_package`, `has_vague_package_description`).

Dates are fixed, never `date.today()`, so the off-peak window goldens never drift.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

from app.features.vendors import (  # type: ignore[import-not-found]
    list_pricing,
    package_quality,
)

# --- fixed dates, never date.today() -------------------------------------------------------------

OFF_PEAK_MID_WINTER = date(2024, 1, 15)
OFF_PEAK_FIRST_DAY = date(2024, 11, 1)
OFF_PEAK_LEAP_LAST_DAY = date(2024, 2, 29)
NOT_OFF_PEAK_FIRST_DAY = date(2024, 3, 1)
NOT_OFF_PEAK_MID_SUMMER = date(2024, 6, 15)
NOT_OFF_PEAK_LAST_DAY = date(2024, 10, 31)

DATE_CASES: list[date] = [
    OFF_PEAK_MID_WINTER,
    OFF_PEAK_FIRST_DAY,
    OFF_PEAK_LEAP_LAST_DAY,
    NOT_OFF_PEAK_FIRST_DAY,
    NOT_OFF_PEAK_MID_SUMMER,
    NOT_OFF_PEAK_LAST_DAY,
]

# --- money strings ---------------------------------------------------------------------------------

MONEY_GBP_CASES: list[str | None] = [
    "£1,200",
    "1.2k",
    "100-200",
    "100 / 200",
    "",
    "   ",
    "-50",
    "0.05",
    "1000000000",
    "999999999",
    "£0.10",
    "150",
    "150.005",
    "abc",
    None,
    "£ 1 2 0",
    "1e3",
]

SINGLE_MONEY_CASES: list[str | None] = [
    "150",
    "150.00",
    "£150",
    "gbp150",
    "GBP 150",
    "",
    "   ",
    None,
    "100, 200",
    "100/200",
    "100-200",
    "starts from 100",
    "from £100",
    "price on request",
    "poa",
    "tbc",
    "100 and 200",
    "abc",
    "0.05",
    "0.1",
    "1000000",
    "1000000.01",
    "-5",
    "1,200",
]


def capture_single_money_kind(raw: str | None) -> dict[str, Any]:
    """One case of `validate_single_money_gbp_kind` plus the message it produces, for a fixed label."""
    kind = list_pricing.validate_single_money_gbp_kind(raw, required=True)
    message = list_pricing.single_money_validation_message(kind, "Package price") if kind else None
    try:
        list_pricing.raise_if_invalid_single_money_gbp(raw, "Package price", required=True)
        raised: dict[str, Any] | None = None
    except Exception as error:  # noqa: BLE001 - capturing the baseline's own exception shape
        raised = {"error": type(error).__name__, "message": str(error)}
    return {
        "raw": raw,
        "kind": kind.value if kind else None,
        "message": message,
        "parsed": list_pricing.parse_single_money_gbp(raw),
        "raise_if_invalid": raised,
    }


PRICING_MODE_CASES: list[Any] = ["per_unit", "PER_UNIT", " per_unit ", "fixed", "", None, 5, True, "other"]

QUANTITY_INPUT_CASES: list[Any] = [
    None,
    "",
    "   ",
    "5",
    "0",
    "-1",
    "100000",
    "100001",
    5,
    5.0,
    5.5,
    0,
    -1,
    True,
    False,
    100_000,
    100_001,
    "05",
    "5.0",
    "abc",
    "５",
]


def package(
    *,
    package_id: str = "pkg-1",
    title: str = "Classic package",
    details: str = "A full day of coverage with two photographers and an online gallery.",
    price: str = "500",
    duration: str = "8 hours",
    pricing_mode: str = "fixed",
    unit_label: str = "",
    min_quantity: Any = None,
    max_quantity: Any = None,
) -> dict[str, Any]:
    """One package dict in the vendor profile payload shape."""
    return {
        "id": package_id,
        "title": title,
        "details": details,
        "price": price,
        "duration": duration,
        "pricingMode": pricing_mode,
        "unitLabel": unit_label,
        "minQuantity": min_quantity,
        "maxQuantity": max_quantity,
    }


def discount_payload(**overrides: Any) -> dict[str, Any]:
    """A profile payload with discount fields, merged over sensible defaults."""
    base = {
        "offerDiscounts": True,
        "discountPercentage": "10",
        "discountLabel": "Early bird",
        "bulkDiscountThreshold": "1000",
        "bulkDiscountPercent": "5",
        "offPeakDiscountPercent": "15",
    }
    base.update(overrides)
    return base


PRICING_OPTIONS_PAYLOADS: list[dict[str, Any]] = [
    {"name": "no packages, no rates", "payload": {}},
    {
        "name": "hourly and daily rates only",
        "payload": {"hourlyRate": "80", "dailyRate": "600", "servicesOffered": ["catering", "dj"]},
    },
    {"name": "hourly rate only", "payload": {"hourlyRate": "80"}},
    {
        "name": "one complete fixed package",
        "payload": {"packages": [package()], "servicesOffered": ["catering"]},
    },
    {
        "name": "one complete fixed package with discount",
        "payload": {**discount_payload(), "packages": [package()]},
    },
    {
        "name": "incomplete package (short details) falls back to rates",
        "payload": {
            "packages": [package(details="too short")],
            "hourlyRate": "50",
        },
    },
    {
        "name": "incomplete package, no rates, falls back to quote",
        "payload": {"packages": [package(details="too short")]},
    },
    {
        "name": "per-unit package complete",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="12.50",
                    min_quantity="10",
                    max_quantity="200",
                ),
            ],
        },
    },
    {
        "name": "per-unit package missing unit label is incomplete",
        "payload": {
            "packages": [package(package_id="pkg-no-label", pricing_mode="per_unit", price="12.50")],
        },
    },
    {
        "name": "per-unit package min above max is incomplete",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-bad-bounds",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="12.50",
                    min_quantity="50",
                    max_quantity="10",
                ),
            ],
        },
    },
    {
        "name": "two complete packages, one incomplete, with services feature lines",
        "payload": {
            "packages": [
                package(package_id="pkg-a", title="Package A"),
                package(package_id="pkg-b", title="Package B", price="750"),
                package(package_id="pkg-c", title="Package C", details="short"),
            ],
            "servicesOffered": ["catering", "baking", "decor", "dj", "mc", "photography", "rentals"],
        },
    },
    {
        "name": "package price unparseable falls back to no price for that option",
        "payload": {"packages": [package(price="ask us")]},
    },
]


def resolve_line_items_case(
    *,
    name: str,
    payload: dict[str, Any],
    selected_option_ids: list[str],
    quantities: dict[str, int] | None = None,
) -> dict[str, Any]:
    """One `resolve_line_items` case: its inputs and either the result or the raised error."""
    inputs = {"payload": payload, "selected_option_ids": selected_option_ids, "quantities": quantities}
    try:
        result = list_pricing.resolve_line_items(payload, selected_option_ids, quantities)
        return {"name": name, **inputs, "result": result, "error": None}
    except Exception as error:  # noqa: BLE001 - capturing the baseline's own exception shape
        return {
            "name": name,
            **inputs,
            "result": None,
            "error": {"error": type(error).__name__, "message": str(error)},
        }


LINE_ITEMS_CASES: list[dict[str, Any]] = [
    {
        "name": "single fixed package success",
        "payload": {"packages": [package()]},
        "selected_option_ids": ["pkg-1"],
        "quantities": None,
    },
    {
        "name": "two fixed packages success",
        "payload": {"packages": [package(package_id="pkg-a"), package(package_id="pkg-b", price="750")]},
        "selected_option_ids": ["pkg-a", "pkg-b"],
        "quantities": None,
    },
    {
        "name": "per-unit package success with quantity",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="12.50",
                    min_quantity="10",
                    max_quantity="200",
                ),
            ],
        },
        "selected_option_ids": ["pkg-per-unit"],
        "quantities": {"pkg-per-unit": 20},
    },
    {
        "name": "empty selection",
        "payload": {"packages": [package()]},
        "selected_option_ids": [],
        "quantities": None,
    },
    {
        "name": "selection is only blank strings",
        "payload": {"packages": [package()]},
        "selected_option_ids": ["  ", ""],
        "quantities": None,
    },
    {
        "name": "duplicate selection",
        "payload": {"packages": [package()]},
        "selected_option_ids": ["pkg-1", "pkg-1"],
        "quantities": None,
    },
    {
        "name": "selected id no longer available",
        "payload": {"packages": [package()]},
        "selected_option_ids": ["missing-package"],
        "quantities": None,
    },
    {
        "name": "per-unit missing quantity",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit", pricing_mode="per_unit", unit_label="guest", price="12.50"
                ),
            ],
        },
        "selected_option_ids": ["pkg-per-unit"],
        "quantities": None,
    },
    {
        "name": "per-unit quantity below minimum",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="12.50",
                    min_quantity="10",
                    max_quantity="200",
                ),
            ],
        },
        "selected_option_ids": ["pkg-per-unit"],
        "quantities": {"pkg-per-unit": 5},
    },
    {
        "name": "per-unit quantity above maximum",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="12.50",
                    min_quantity="10",
                    max_quantity="200",
                ),
            ],
        },
        "selected_option_ids": ["pkg-per-unit"],
        "quantities": {"pkg-per-unit": 500},
    },
    {
        "name": "line total too high",
        "payload": {
            "packages": [
                package(
                    package_id="pkg-per-unit",
                    pricing_mode="per_unit",
                    unit_label="guest",
                    price="999999",
                    min_quantity="1",
                    max_quantity="100000",
                ),
            ],
        },
        "selected_option_ids": ["pkg-per-unit"],
        "quantities": {"pkg-per-unit": 100000},
    },
    {
        "name": "quote only selected correctly",
        "payload": {},
        "selected_option_ids": ["quote"],
        "quantities": None,
    },
    {
        "name": "quote only selected id does not exist",
        "payload": {},
        "selected_option_ids": ["not-a-real-id"],
        "quantities": None,
    },
]


AUTO_DISCOUNT_CASES: list[dict[str, Any]] = [
    {
        "name": "bulk and off-peak both apply",
        "payload": discount_payload(
            bulkDiscountThreshold="400", bulkDiscountPercent="10", offPeakDiscountPercent="20"
        ),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": OFF_PEAK_MID_WINTER,
    },
    {
        "name": "bulk only, not off-peak",
        "payload": discount_payload(
            bulkDiscountThreshold="400", bulkDiscountPercent="10", offPeakDiscountPercent="20"
        ),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": NOT_OFF_PEAK_MID_SUMMER,
    },
    {
        "name": "below bulk threshold, off-peak still applies",
        "payload": discount_payload(
            bulkDiscountThreshold="1000", bulkDiscountPercent="10", offPeakDiscountPercent="20"
        ),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": OFF_PEAK_MID_WINTER,
    },
    {
        "name": "discounts switched off",
        "payload": discount_payload(offerDiscounts=False),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": OFF_PEAK_MID_WINTER,
    },
    {
        "name": "no positive line items",
        "payload": discount_payload(),
        "line_items": [],
        "event_date": OFF_PEAK_MID_WINTER,
    },
    {
        "name": "existing auto lines are stripped and recalculated",
        "payload": discount_payload(
            bulkDiscountThreshold="400", bulkDiscountPercent="10", offPeakDiscountPercent="20"
        ),
        "line_items": [
            {"id": "pkg-1", "unit_price_gbp": 500.0},
            {"id": list_pricing.AUTO_BULK_LINE_ID, "unit_price_gbp": -999.0},
        ],
        "event_date": OFF_PEAK_MID_WINTER,
    },
    {
        "name": "off-peak boundary first day",
        "payload": discount_payload(
            bulkDiscountThreshold=None, bulkDiscountPercent=None, offPeakDiscountPercent="20"
        ),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": OFF_PEAK_FIRST_DAY,
    },
    {
        "name": "off-peak boundary day after (not off-peak)",
        "payload": discount_payload(
            bulkDiscountThreshold=None, bulkDiscountPercent=None, offPeakDiscountPercent="20"
        ),
        "line_items": [{"id": "pkg-1", "unit_price_gbp": 500.0}],
        "event_date": NOT_OFF_PEAK_FIRST_DAY,
    },
]


def capture_auto_discount(case: dict[str, Any]) -> dict[str, Any]:
    """One `compute_automatic_discount_lines` and `reconcile_automatic_discount_lines` case."""
    computed = list_pricing.compute_automatic_discount_lines(
        case["payload"], case["line_items"], case["event_date"]
    )
    reconciled = list_pricing.reconcile_automatic_discount_lines(
        case["line_items"], case["payload"], case["event_date"]
    )
    return {
        "name": case["name"],
        "payload": case["payload"],
        "line_items": case["line_items"],
        "event_date": case["event_date"].isoformat(),
        "computed": computed,
        "reconciled": reconciled,
    }


PACKAGE_FIELD_CASES: list[dict[str, Any]] = [
    {
        "name": "blank package skipped",
        "package": package(title="", price="", details="", duration=""),
        "strict": False,
    },
    {"name": "complete fixed package, non-strict", "package": package(), "strict": False},
    {"name": "complete fixed package, strict", "package": package(), "strict": True},
    {"name": "title too short", "package": package(title="Ab"), "strict": False},
    {"name": "missing title but has price (configured)", "package": package(title=""), "strict": False},
    {"name": "missing price, fixed", "package": package(price=""), "strict": False},
    {
        "name": "missing price, per-unit",
        "package": package(pricing_mode="per_unit", unit_label="guest", price=""),
        "strict": False,
    },
    {"name": "invalid price range", "package": package(price="100-200"), "strict": False},
    {"name": "details too short, strict", "package": package(details="short"), "strict": True},
    {
        "name": "details too short, non-strict but priced",
        "package": package(details="short"),
        "strict": False,
    },
    {
        "name": "per-unit missing unit label",
        "package": package(pricing_mode="per_unit", price="12.50"),
        "strict": False,
    },
    {
        "name": "per-unit unit label too long",
        "package": package(pricing_mode="per_unit", price="12.50", unit_label="x" * 41),
        "strict": False,
    },
    {
        "name": "per-unit min quantity invalid",
        "package": package(pricing_mode="per_unit", price="12.50", unit_label="guest", min_quantity="abc"),
        "strict": False,
    },
    {
        "name": "per-unit max quantity invalid",
        "package": package(pricing_mode="per_unit", price="12.50", unit_label="guest", max_quantity="-1"),
        "strict": False,
    },
    {
        "name": "per-unit min above max",
        "package": package(
            pricing_mode="per_unit",
            price="12.50",
            unit_label="guest",
            min_quantity="50",
            max_quantity="10",
        ),
        "strict": False,
    },
    {
        "name": "per-unit complete",
        "package": package(
            pricing_mode="per_unit",
            price="12.50",
            unit_label="guest",
            min_quantity="10",
            max_quantity="200",
        ),
        "strict": False,
    },
]


def capture_package_fields(case: dict[str, Any]) -> dict[str, Any]:
    """One `validate_package_fields` case: its inputs and either success or the raised error."""
    try:
        package_quality.validate_package_fields(case["package"], strict=case["strict"])
        error: dict[str, Any] | None = None
    except Exception as raised:  # noqa: BLE001 - capturing the baseline's own exception shape
        error = {"error": type(raised).__name__, "message": str(raised)}
    return {"name": case["name"], "package": case["package"], "strict": case["strict"], "error": error}


PACKAGES_PAYLOAD_CASES: list[dict[str, Any]] = [
    {
        "name": "no services requiring packages, no packages, not on submit",
        "payload": {"servicesOffered": ["photography"]},
        "on_submit": False,
        "require_service_packages": False,
    },
    {
        "name": "catering requires a package, none complete, on submit",
        "payload": {"servicesOffered": ["catering"], "packages": [package(details="short")]},
        "on_submit": True,
        "require_service_packages": False,
    },
    {
        "name": "catering requires a package, one complete, on submit, has photo",
        "payload": {
            "servicesOffered": ["catering"],
            "packages": [package()],
            "profileImageUrl": "https://example.com/photo.jpg",
        },
        "on_submit": True,
        "require_service_packages": False,
    },
    {
        "name": "on submit missing profile photo",
        "payload": {"servicesOffered": ["photography"], "packages": [package()]},
        "on_submit": True,
        "require_service_packages": False,
    },
    {
        "name": "require_service_packages true, not on submit, no complete package",
        "payload": {"servicesOffered": ["decor"], "packages": []},
        "on_submit": False,
        "require_service_packages": True,
    },
    {
        "name": "broken package field fails before the completeness check",
        "payload": {"servicesOffered": ["catering"], "packages": [package(title="")]},
        "on_submit": True,
        "require_service_packages": False,
    },
    {
        "name": "not a list of packages",
        "payload": {"servicesOffered": ["catering"], "packages": "oops"},
        "on_submit": True,
        "require_service_packages": False,
    },
]


def capture_packages_payload(case: dict[str, Any]) -> dict[str, Any]:
    """One `validate_packages_for_payload` case: its inputs and either success or the raised error."""
    try:
        package_quality.validate_packages_for_payload(
            case["payload"],
            on_submit=case["on_submit"],
            require_service_packages=case["require_service_packages"],
        )
        error: dict[str, Any] | None = None
    except Exception as raised:  # noqa: BLE001 - capturing the baseline's own exception shape
        error = {"error": type(raised).__name__, "message": str(raised)}
    return {
        "name": case["name"],
        "payload": case["payload"],
        "on_submit": case["on_submit"],
        "require_service_packages": case["require_service_packages"],
        "error": error,
    }


PACKAGE_QUALITY_PAYLOADS: list[dict[str, Any]] = [
    {"name": "no packages", "payload": {}},
    {"name": "one complete package", "payload": {"packages": [package()]}},
    {
        "name": "one complete, one incomplete",
        "payload": {"packages": [package(package_id="pkg-a"), package(package_id="pkg-b", details="short")]},
    },
    {
        "name": "two complete packages",
        "payload": {
            "packages": [
                package(package_id="pkg-a"),
                package(package_id="pkg-b", price="750"),
            ],
        },
    },
    {
        "name": "one unconfigured (blank) package",
        "payload": {"packages": [package(title="", price="", details="", duration="")]},
    },
    {"name": "packages not a list", "payload": {"packages": "oops"}},
]


def capture_package_quality(case: dict[str, Any]) -> dict[str, Any]:
    """One completeness/quality-level case, plus the raw `is_complete_package` for each row."""
    complete_count, configured_count = package_quality.count_complete_packages(case["payload"])
    packages = case["payload"].get("packages")
    per_package = []
    if isinstance(packages, list):
        for row in packages:
            if isinstance(row, dict):
                per_package.append(
                    {
                        "configured": package_quality.is_configured_package(row),
                        "complete": package_quality.is_complete_package(row),
                    },
                )
    return {
        "name": case["name"],
        "payload": case["payload"],
        "complete_count": complete_count,
        "configured_count": configured_count,
        "quality_level": package_quality.package_quality_level(case["payload"]),
        "per_package": per_package,
    }


VAGUE_DESCRIPTION_CASES: list[str] = [
    "Ask the vendor for a price.",
    "A full day of coverage with two photographers and an online gallery.",
    "Contact for details.",
    "POA",
    "Enquire for our best rate.",
    "",
]


def write_json(path: Path, value: object) -> None:
    """Write `value` as stable, readable JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n")


def main(golden_dir: Path) -> None:
    """Write every vendor list-pricing and package-quality golden file."""
    vendors_dir = golden_dir / "vendors"

    write_json(
        vendors_dir / "money_gbp.json",
        [{"raw": raw, "parsed": list_pricing.parse_money_gbp(raw)} for raw in MONEY_GBP_CASES],
    )
    write_json(
        vendors_dir / "single_money.json", [capture_single_money_kind(raw) for raw in SINGLE_MONEY_CASES]
    )
    write_json(
        vendors_dir / "pricing_mode.json",
        [{"raw": repr(raw), "mode": list_pricing.parse_pricing_mode(raw)} for raw in PRICING_MODE_CASES],
    )
    write_json(
        vendors_dir / "quantity_input.json",
        [
            {"raw": repr(raw), "value": value, "invalid": invalid}
            for raw in QUANTITY_INPUT_CASES
            for value, invalid in [list_pricing.parse_quantity_input(raw)]
        ],
    )
    write_json(
        vendors_dir / "pricing_options.json",
        [
            {
                "name": case["name"],
                "payload": case["payload"],
                "options": [
                    option.__dict__ for option in list_pricing.build_pricing_options(case["payload"])
                ],
                "min_listing_price_gbp": list_pricing.min_listing_price_gbp(case["payload"]),
            }
            for case in PRICING_OPTIONS_PAYLOADS
        ],
    )
    write_json(
        vendors_dir / "line_items.json",
        [
            resolve_line_items_case(
                name=case["name"],
                payload=case["payload"],
                selected_option_ids=case["selected_option_ids"],
                quantities=case["quantities"],
            )
            for case in LINE_ITEMS_CASES
        ],
    )
    write_json(
        vendors_dir / "auto_discounts.json", [capture_auto_discount(case) for case in AUTO_DISCOUNT_CASES]
    )
    write_json(
        vendors_dir / "package_fields.json", [capture_package_fields(case) for case in PACKAGE_FIELD_CASES]
    )
    write_json(
        vendors_dir / "packages_payload.json",
        [capture_packages_payload(case) for case in PACKAGES_PAYLOAD_CASES],
    )
    write_json(
        vendors_dir / "package_quality.json",
        [capture_package_quality(case) for case in PACKAGE_QUALITY_PAYLOADS],
    )
    write_json(
        vendors_dir / "vague_descriptions.json",
        [
            {"details": details, "vague": package_quality.has_vague_package_description(details)}
            for details in VAGUE_DESCRIPTION_CASES
        ],
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
