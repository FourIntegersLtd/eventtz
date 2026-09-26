"""Capture the referrals and pricing goldens from the baseline: slugs, codes, tiers, fee maths, names.

Run with `make capture SCRIPT=capture/referrals_goldens.py` (never directly). Output
goes to `referrals/` and `pricing/` under the golden directory:

- `referrals/slugs.json`: partner slug normalisation and validity.
- `referrals/client_codes.json`: vendor client-code normalisation.
- `referrals/fee_tiers.json`: the discount and tier minimum for a range of spends.
- `referrals/stored_discounts.json`: the discount an existing booking keeps for its stored
  code. The baseline looks the code's owner up in the database; here that lookup is
  replaced by a fixed table, so the golden records the rule and not the data.
- `referrals/client_names.json`: the friendly client name built from an email address.
- `pricing/money_labels.json`, `pricing/fee_percent.json`, `pricing/breakdowns.json`,
  `pricing/vendor_portions.json`: the booking price maths shared with bookings and payments.

Adjustment ids in the cases are all at least 8 characters long, because shorter ids are
replaced with a random UUID (covered by a unit test instead). Add a case whenever the
api/ implementation takes a branch no case covers, then re-capture.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from app.features.auth import user_vendor_display_lookup  # type: ignore[import-not-found]
from app.features.bookings.pricing import (  # type: ignore[import-not-found]
    build_pricing_breakdown,
    format_gbp,
    persisted_booking_total_label,
    resolve_booking_service_fee_percent,
)
from app.features.referrals.slug import is_valid_slug, normalize_slug  # type: ignore[import-not-found]
from app.features.vendor_referrals import booking_discount  # type: ignore[import-not-found]
from app.features.vendor_referrals.codes import (
    normalize_client_referral_code,  # type: ignore[import-not-found]
)
from app.features.vendor_referrals.tiers import (  # type: ignore[import-not-found]
    referral_fee_discount_for_spend,
    referral_tier_min_spend,
)

SLUG_CASES: list[str] = [
    "Creator Name",
    "  Spaces  and--dashes  ",
    "Café Déjà Vu",
    "under_score",
    "Mixed CASE 123",
    "a  -  b",
    "-lead-trail-",
    "émoji 🎉 party",
    "tab\tname\nnewline",
    "ÆØÅ",
    "日本語",
    "!!!",
    "",
    "already-a-slug",
    "dots.and,commas",
    "O'Brien & Sons",
]

CLIENT_CODE_CASES: list[str | None] = [
    "123",
    " 12-34 ",
    "12 34 56",
    "000000",
    "0",
    "123456",
    "1234567",
    "abc",
    "a1b2c3",
    "--",
    "",
    None,
    "１２３",
]

SPEND_CASES: list[float] = [-5.0, 0.0, 0.01, 399.99, 400.0, 400.01, 599.99, 600.0, 10_000.0]

# The vendor who owns each code in the stored-discount cases (codes not listed have no owner).
CODE_OWNERS: dict[str, str] = {"111111": "vendor-a", "222222": "vendor-b"}

STORED_DISCOUNT_CASES: list[tuple[dict[str, Any], float]] = [
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "111111"}, 500.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "111111"}, 650.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "111111"}, 399.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": " 11-11-11 "}, 500.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "222222"}, 700.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "333333"}, 700.0),
    ({"vendor_user_id": "", "vendor_referral_code": "222222"}, 700.0),
    ({"vendor_referral_code": "222222"}, 450.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": None}, 700.0),
    ({"vendor_user_id": "vendor-a", "vendor_referral_code": "abc"}, 700.0),
    ({"vendor_user_id": "vendor-a"}, 700.0),
]

EMAIL_CASES: list[str | None] = [
    "jane.doe_92@example.com",
    "JOHN@example.com",
    "mary-ann.o_neil@example.com",
    "  spaced.name@example.com",
    "a..b@example.com",
    "émile.zola@example.com",
    "x7@example.com",
    "123@example.com",
    "12.34@example.com",
    "@example.com",
    "no-at-sign",
    "",
    None,
]

MONEY_CASES: list[float] = [
    0.0,
    1.0,
    1.5,
    1.005,
    2.675,
    10.999,
    -15.0,
    -0.5,
    0.004,
    -0.004,
    1_234_567.891,
    float("nan"),
]

FEE_PERCENT_ROWS: list[Any] = [
    {},
    {"service_fee_percent": None},
    {"service_fee_percent": 7.5},
    {"service_fee_percent": "3"},
    {"service_fee_percent": 0},
    {"service_fee_percent": 100},
    {"service_fee_percent": 101},
    {"service_fee_percent": -1},
    {"service_fee_percent": "abc"},
    "not a row",
    None,
]


def adjustment(adjustment_id: str, amount: Any, **extra: Any) -> dict[str, Any]:
    """One vendor adjustment with a long (kept) id."""
    return {"id": adjustment_id, "amount_gbp": amount, **extra}


BREAKDOWN_CASES: list[dict[str, Any]] = [
    {"name": "plain", "line_items": [{"unit_price_gbp": 500}], "vendor_adjustments": []},
    {
        "name": "first tier",
        "line_items": [{"unit_price_gbp": 500}],
        "vendor_adjustments": [],
        "referral_fee_discount_gbp": 10.0,
        "referral_tier_min_spend_gbp": 400.0,
    },
    {
        "name": "second tier",
        "line_items": [{"unit_price_gbp": 700}],
        "vendor_adjustments": [],
        "referral_fee_discount_gbp": 15.0,
        "referral_tier_min_spend_gbp": 600.0,
    },
    {
        "name": "discount capped at the fee",
        "line_items": [{"unit_price_gbp": 100}],
        "vendor_adjustments": [],
        "referral_fee_discount_gbp": 15.0,
    },
    {
        "name": "negative discount ignored",
        "line_items": [{"unit_price_gbp": 100}],
        "vendor_adjustments": [],
        "referral_fee_discount_gbp": -3.0,
    },
    {
        "name": "tbc and priced",
        "line_items": [{"unit_price_gbp": None}, {"unit_price_gbp": 500}],
        "vendor_adjustments": [],
    },
    {"name": "tbc only", "line_items": [{"unit_price_gbp": None}], "vendor_adjustments": []},
    {"name": "unparseable price", "line_items": [{"unit_price_gbp": "abc"}], "vendor_adjustments": []},
    {"name": "string price", "line_items": [{"unit_price_gbp": "12.50"}], "vendor_adjustments": []},
    {"name": "no line items", "line_items": [], "vendor_adjustments": []},
    {"name": "line items not a list", "line_items": "oops", "vendor_adjustments": None},
    {
        "name": "non-dict line items",
        "line_items": ["x", 5, {"unit_price_gbp": 20}],
        "vendor_adjustments": "oops",
    },
    {
        "name": "pennies",
        "line_items": [{"unit_price_gbp": 19.99}, {"unit_price_gbp": 0.01}, {"unit_price_gbp": 33.333}],
        "vendor_adjustments": [],
    },
    {
        "name": "travel adjustment",
        "line_items": [{"unit_price_gbp": 300}],
        "vendor_adjustments": [adjustment("adjustment-0001", 150, label="Travel", tag="travel")],
    },
    {
        "name": "discount below zero",
        "line_items": [{"unit_price_gbp": 100}],
        "vendor_adjustments": [adjustment("discount-0001", -200, label="Goodwill", tag="discount")],
    },
    {
        "name": "tbc with a discount below zero",
        "line_items": [{"unit_price_gbp": None}],
        "vendor_adjustments": [adjustment("discount-0002", -50)],
    },
    {
        "name": "adjustment clean-up",
        "line_items": [{"unit_price_gbp": 100}],
        "vendor_adjustments": [
            adjustment("zero-amount-01", 0),
            adjustment("bad-amount-01", "lots"),
            adjustment("huge-amount-01", 1e9),
            adjustment("tiny-amount-01", -1e9),
            adjustment("rounded-amt-01", 10.005),
            adjustment("defaults-0001", "7"),
            adjustment("long-text-001", 1, label="L" * 250, tag="T" * 80),
            adjustment("blank-text-01", 2, label="   ", tag="   "),
            "not a dict",
        ],
    },
    {
        "name": "adjustments cut at twenty",
        "line_items": [{"unit_price_gbp": 10}],
        "vendor_adjustments": [adjustment(f"adjustment-{index:04d}", 1) for index in range(25)],
    },
    {
        "name": "fee percent above 100",
        "line_items": [{"unit_price_gbp": 80}],
        "vendor_adjustments": [],
        "service_fee_percent": 150,
    },
    {
        "name": "fee percent below 0",
        "line_items": [{"unit_price_gbp": 80}],
        "vendor_adjustments": [],
        "service_fee_percent": -5,
    },
    {
        "name": "fee percent zero",
        "line_items": [{"unit_price_gbp": 80}],
        "vendor_adjustments": [],
        "service_fee_percent": 0,
    },
    {
        "name": "fee percent custom",
        "line_items": [{"unit_price_gbp": 333.33}],
        "vendor_adjustments": [],
        "service_fee_percent": 7.5,
    },
]

VENDOR_PORTION_ROWS: list[dict[str, Any]] = [
    {"line_items": [{"unit_price_gbp": 300}], "vendor_adjustments": [adjustment("adjustment-0001", 150)]},
    {"line_items": [{"unit_price_gbp": None}, {"unit_price_gbp": 10.555}], "vendor_adjustments": None},
    {"line_items": "oops", "vendor_adjustments": [adjustment("adjustment-0002", -20)]},
    {},
]


def capture_stored_discounts() -> list[dict[str, Any]]:
    """Run the stored-code discount rule with the owner lookup answered from `CODE_OWNERS`."""

    def owner_row(code: str) -> dict[str, Any] | None:
        """The baseline's code-owner lookup, answered from `CODE_OWNERS` instead of the database."""
        normalised = normalize_client_referral_code(code)
        owner = CODE_OWNERS.get(normalised or "")
        return {"user_id": owner, "client_referral_code": normalised} if owner else None

    booking_discount.get_vendor_referral_row_by_code = owner_row
    results = []
    for row, spend in STORED_DISCOUNT_CASES:
        discount, tier_min = booking_discount.stored_referral_discount_for_spend(row, spend)
        results.append({"row": row, "spend": spend, "discount": discount, "tier_min_spend": tier_min})
    return results


def capture_breakdown(case: dict[str, Any]) -> dict[str, Any]:
    """One breakdown and the total label that would be stored for it."""
    arguments = {key: value for key, value in case.items() if key != "name"}
    breakdown = build_pricing_breakdown(**arguments)
    return {
        "case": case,
        "breakdown": breakdown,
        "persisted_total_label": persisted_booking_total_label(breakdown),
    }


def write_json(path: Path, value: object) -> None:
    """Write `value` as stable, readable JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n")


def main(golden_dir: Path) -> None:
    """Write every referrals and pricing golden file."""
    referrals_dir = golden_dir / "referrals"
    pricing_dir = golden_dir / "pricing"
    write_json(
        referrals_dir / "slugs.json",
        [
            {"raw": raw, "normalised": normalize_slug(raw), "valid": is_valid_slug(normalize_slug(raw))}
            for raw in SLUG_CASES
        ],
    )
    write_json(
        referrals_dir / "client_codes.json",
        [{"raw": raw, "normalised": normalize_client_referral_code(raw)} for raw in CLIENT_CODE_CASES],
    )
    write_json(
        referrals_dir / "fee_tiers.json",
        [
            {
                "spend": spend,
                "discount": referral_fee_discount_for_spend(spend),
                "tier_min_spend": referral_tier_min_spend(spend),
            }
            for spend in SPEND_CASES
        ],
    )
    write_json(referrals_dir / "stored_discounts.json", capture_stored_discounts())
    write_json(
        referrals_dir / "client_names.json",
        [
            {"email": email, "friendly_name": user_vendor_display_lookup._friendly_name_from_email(email)}
            for email in EMAIL_CASES
        ],
    )
    write_json(
        pricing_dir / "money_labels.json",
        [{"amount": repr(amount), "label": format_gbp(amount)} for amount in MONEY_CASES],
    )
    write_json(
        pricing_dir / "fee_percent.json",
        [{"row": row, "percent": resolve_booking_service_fee_percent(row)} for row in FEE_PERCENT_ROWS],
    )
    write_json(pricing_dir / "breakdowns.json", [capture_breakdown(case) for case in BREAKDOWN_CASES])
    write_json(
        pricing_dir / "vendor_portions.json",
        [
            {
                "row": row,
                "with_adjustments": booking_discount.vendor_portion_gbp_from_row(
                    row, include_adjustments=True
                ),
                "without_adjustments": booking_discount.vendor_portion_gbp_from_row(
                    row, include_adjustments=False
                ),
            }
            for row in VENDOR_PORTION_ROWS
        ],
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
