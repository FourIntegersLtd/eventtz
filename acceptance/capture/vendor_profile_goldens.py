"""Capture the vendor profile goldens from the baseline.

Covers form tidying, step checks, visibility and listing photos.

Run with `make capture SCRIPT=capture/vendor_profile_goldens.py` (never directly). Output
goes to `vendors/` under the golden directory:

- `profile_normalize.json`: `normalize_payload_fields` on forms with out-of-range numbers,
  foreign upload URLs, odd dates and locations. Records the bucket host it ran with, so the
  api/ side can pass the same host in.
- `profile_steps.json`: `validate_step_fields` per step, as "ok" or the error message.
- `profile_progress.json`: `validate_payload_for_progress` on moves forward and on submit,
  with the (possibly narrowed) services list afterwards.
- `phones.json`, `business_names.json`, `bios.json`, `explore_patches.json`: the small rules.
- `visibility.json`: payouts-verified and publicly-listable for rows across every branch.
- `listing_media.json`: public photo order and cover, and the admin override result (or error).

Add a case whenever the api/ implementation takes a branch no case covers, then re-capture.
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

from app.core.errors import ValidationError  # type: ignore[import-not-found]
from app.core.phone_validation import is_valid_phone_number  # type: ignore[import-not-found]
from app.features.media.s3 import s3_public_host  # type: ignore[import-not-found]
from app.features.vendors import listing_media  # type: ignore[import-not-found]
from app.features.vendors.business_name import (  # type: ignore[import-not-found]
    business_name_from_payload,
    normalize_business_name,
)
from app.features.vendors.explore_index import (  # type: ignore[import-not-found]
    explore_search_patch_from_payload,
)
from app.features.vendors.profile import _clamp_bio_words  # type: ignore[import-not-found]
from app.features.vendors.profile_form_validation import (  # type: ignore[import-not-found]
    normalize_payload_fields,
    validate_payload_for_progress,
    validate_step_fields,
)
from app.features.vendors.visibility import (  # type: ignore[import-not-found]
    listing_override_of,
    row_is_publicly_listable,
    vendor_payouts_verified,
)

USER_ID = "vendor-0001"
HOST = s3_public_host()


def own(name: str) -> str:
    """A URL for this vendor's own upload in our bucket."""
    return f"https://{HOST}/users/{USER_ID}/{name}"


def foreign_host(name: str) -> str:
    """A URL on another host with the right folder shape."""
    return f"https://evil.example.com/users/{USER_ID}/{name}"


def other_vendor(name: str) -> str:
    """A URL in our bucket, but in another vendor's folder."""
    return f"https://{HOST}/users/vendor-9999/{name}"


PORTFOLIO = [own(f"portfolio-{number}.jpg") for number in range(1, 7)]
PROFILE_PHOTO = own("profile.jpg")

COMPLETE_FORM: dict[str, Any] = {
    "firstName": "Ada",
    "lastName": "Lovelace",
    "phone": "07700 900123",
    "businessName": "  Ada's   Cakes ",
    "servicesOffered": ["baking", "Catering", "unknown"],
    "countryCode": "gb",
    "baseCity": " London ",
    "deliveryModes": ["travel"],
    "travelRadius": "25",
    "travelDeliveryPolicy": "included",
    "hourlyRate": "",
    "dailyRate": "",
    "packages": [
        {
            "title": "Wedding cake",
            "price": "450",
            "details": "Three tier sponge with buttercream, delivered and set up at your venue on the day.",
            "pricingMode": "fixed",
        },
        {
            "title": "Catering buffet",
            "price": "25",
            "details": "A hot and cold buffet for your guests, with vegetarian and vegan options included.",
            "pricingMode": "per_unit",
            "unitLabel": "guest",
            "minQuantity": "20",
            "maxQuantity": "200",
        },
    ],
    "offerDiscounts": False,
    "availableWeekdays": ["sat", "sun"],
    "maxBookingsPerDay": "2",
    "portfolioFileNames": PORTFOLIO,
    "profileImageUrl": PROFILE_PHOTO,
}

NORMALIZE_CASES: list[dict[str, Any]] = [
    {"name": "empty", "payload": {}},
    {"name": "complete", "payload": COMPLETE_FORM},
    {
        "name": "discounts off blanks them",
        "payload": {
            "offerDiscounts": False,
            "discountPercentage": "10",
            "discountLabel": "Spring",
            "bulkDiscountThreshold": "500",
            "bulkDiscountPercent": "5",
            "offPeakDiscountPercent": "15",
        },
    },
    {
        "name": "discounts clamp",
        "payload": {
            "offerDiscounts": True,
            "discountLabel": "Spring",
            "discountPercentage": "150",
            "bulkDiscountPercent": "-5",
            "offPeakDiscountPercent": "12.5",
            "bulkDiscountThreshold": "2000000",
        },
    },
    {"name": "discount junk", "payload": {"offerDiscounts": True, "discountPercentage": "abc"}},
    {
        "name": "rates clamp",
        "payload": {"hourlyRate": "£1,250.50", "dailyRate": "99999999", "maxBookingsPerDay": "50"},
    },
    {"name": "rate text kept", "payload": {"hourlyRate": " from 100 ", "dailyRate": 300}},
    {"name": "max bookings low", "payload": {"maxBookingsPerDay": "0"}},
    {"name": "max bookings junk", "payload": {"maxBookingsPerDay": "lots"}},
    {
        "name": "packages",
        "payload": {
            "packages": [
                {"title": "A", "price": "12.50", "pricingMode": "per_unit", "unitLabel": "  " + "x" * 60},
                {"title": "B", "price": "abc", "pricingMode": "weird", "minQuantity": "0", "maxQuantity": ""},
                {"title": "C", "price": 10, "minQuantity": 3, "maxQuantity": "2.5"},
                {"title": "D", "price": "100.10", "minQuantity": "", "maxQuantity": None},
                "not a package",
            ],
        },
    },
    {
        "name": "uploads",
        "payload": {
            "portfolioFileNames": [
                PORTFOLIO[0],
                PORTFOLIO[0],
                "  " + PORTFOLIO[1] + "  ",
                foreign_host("a.jpg"),
                other_vendor("b.jpg"),
                "ftp://nope",
                42,
                "",
            ],
            "listingHiddenImageUrls": [PORTFOLIO[2], foreign_host("c.jpg")],
            "listingDisplayOrder": [PORTFOLIO[3], PORTFOLIO[2]],
            "listingTailImageUrls": [PORTFOLIO[4]],
            "portfolioVideoNamesPersisted": [own("v1.mp4"), own("legacy.mp4"), foreign_host("v.mp4")],
            "portfolioVideoNamePersisted": own("legacy.mp4"),
            "uploadedFileLabels": {" doc ": "  My certificate " + "y" * 250, "blank": "   ", "number": 3},
            "foodHygieneCertNamePersisted": own("hygiene.pdf"),
            "indemnityCertNamePersisted": foreign_host("indemnity.pdf"),
            "profileImageUrl": "  " + PROFILE_PHOTO,
            "listingCoverImageUrl": other_vendor("cover.jpg"),
            "otherDocsNamesPersisted": [own("doc1.pdf"), foreign_host("doc2.pdf")],
        },
    },
    {
        "name": "too many uploads",
        "payload": {"portfolioFileNames": [own(f"p{number}.jpg") for number in range(40)]},
    },
    {"name": "legacy video only", "payload": {"portfolioVideoNamePersisted": own("only.mp4")}},
    {"name": "videos not a list", "payload": {"portfolioVideoNamesPersisted": "x"}},
    {"name": "other docs empty list", "payload": {"otherDocsNamesPersisted": []}},
    {"name": "labels not a dict", "payload": {"uploadedFileLabels": ["a"]}},
    {
        "name": "blocked dates",
        "payload": {
            "blockedDates": ["2026-10-01", "2026-10-02T00:00:00Z", "1/2/2026", 20261001, None, "2026-1-1"]
        },
    },
    {
        "name": "location",
        "payload": {"countryCode": " us ", "region": "  " + "r" * 200, "postalCode": " SW1A 1AA " + "9" * 40},
    },
    {"name": "location blanks", "payload": {"countryCode": "", "region": "   ", "postalCode": None}},
]


def outcome(check: Any) -> str:
    """Run a check: "ok", or the ValidationError message it raised."""
    try:
        check()
    except ValidationError as error:
        return str(error)
    return "ok"


def with_changes(base: dict[str, Any], **changes: Any) -> dict[str, Any]:
    """A deep copy of `base` with `changes` applied (a value of None deletes the key)."""
    changed = copy.deepcopy(base)
    for key, value in changes.items():
        if value is None:
            changed.pop(key, None)
        else:
            changed[key] = value
    return changed


STEP_CASES: list[dict[str, Any]] = [
    {"name": "complete", "payload": COMPLETE_FORM},
    {"name": "empty", "payload": {}},
    {"name": "no last name", "payload": with_changes(COMPLETE_FORM, lastName=" ")},
    {"name": "no phone", "payload": with_changes(COMPLETE_FORM, phone="")},
    {"name": "bad phone", "payload": with_changes(COMPLETE_FORM, phone="12345")},
    {"name": "unsupported country", "payload": with_changes(COMPLETE_FORM, countryCode="FR")},
    {"name": "no delivery", "payload": with_changes(COMPLETE_FORM, deliveryModes=[" "])},
    {"name": "no radius", "payload": with_changes(COMPLETE_FORM, travelRadius="")},
    {"name": "no policy", "payload": with_changes(COMPLETE_FORM, travelDeliveryPolicy="")},
    {"name": "custom policy no text", "payload": with_changes(COMPLETE_FORM, travelDeliveryPolicy="custom")},
    {
        "name": "custom policy with text",
        "payload": with_changes(
            COMPLETE_FORM,
            travelDeliveryPolicy="custom",
            travelDeliveryPolicyCustomText="Free within 10 miles",
        ),
    },
    {"name": "no prices", "payload": with_changes(COMPLETE_FORM, packages=[], servicesOffered=["dj"])},
    {
        "name": "rate only",
        "payload": with_changes(COMPLETE_FORM, packages=[], servicesOffered=["dj"], hourlyRate="80"),
    },
    {"name": "bad rate", "payload": with_changes(COMPLETE_FORM, hourlyRate="80-120")},
    {"name": "discount no name", "payload": with_changes(COMPLETE_FORM, offerDiscounts=True)},
    {
        "name": "discount no option",
        "payload": with_changes(COMPLETE_FORM, offerDiscounts=True, discountLabel="Spring"),
    },
    {
        "name": "discount bulk half",
        "payload": with_changes(
            COMPLETE_FORM, offerDiscounts=True, discountLabel="Spring", bulkDiscountThreshold="500"
        ),
    },
    {
        "name": "discount pct high",
        "payload": with_changes(
            COMPLETE_FORM, offerDiscounts=True, discountLabel="Spring", discountPercentage="150"
        ),
    },
    {
        "name": "discount pct junk",
        "payload": with_changes(
            COMPLETE_FORM, offerDiscounts=True, discountLabel="Spring", offPeakDiscountPercent="lots"
        ),
    },
    {
        "name": "discount ok",
        "payload": with_changes(
            COMPLETE_FORM,
            offerDiscounts=True,
            discountLabel="Spring",
            bulkDiscountThreshold="500",
            bulkDiscountPercent="5",
        ),
    },
    {"name": "no weekdays", "payload": with_changes(COMPLETE_FORM, availableWeekdays=[])},
    {"name": "max bookings high", "payload": with_changes(COMPLETE_FORM, maxBookingsPerDay="21")},
    {"name": "max bookings junk", "payload": with_changes(COMPLETE_FORM, maxBookingsPerDay="many")},
    {"name": "max bookings blank", "payload": with_changes(COMPLETE_FORM, maxBookingsPerDay="")},
    {"name": "few photos", "payload": with_changes(COMPLETE_FORM, portfolioFileNames=PORTFOLIO[:4])},
    {
        "name": "many photos",
        "payload": with_changes(
            COMPLETE_FORM, portfolioFileNames=[own(f"p{number}.jpg") for number in range(21)]
        ),
    },
    {
        "name": "vague package",
        "payload": with_changes(COMPLETE_FORM, packages=[{"title": "Package 1", "price": "10"}]),
    },
]

PROGRESS_CASES: list[dict[str, Any]] = [
    {
        "name": "draft forward from 1",
        "current": 3,
        "previous": 1,
        "status": "draft",
        "payload": COMPLETE_FORM,
    },
    {"name": "draft forward bad account", "current": 2, "previous": 1, "status": None, "payload": {}},
    {"name": "draft backwards", "current": 1, "previous": 5, "status": "draft", "payload": {}},
    {"name": "draft same step", "current": 4, "previous": 4, "status": "draft", "payload": {}},
    {"name": "draft from zero", "current": 4, "previous": 0, "status": "draft", "payload": {}},
    {"name": "submit complete", "current": 8, "previous": 8, "status": "submitted", "payload": COMPLETE_FORM},
    {
        "name": "complete status",
        "current": 8,
        "previous": 8,
        "status": " Complete ",
        "payload": COMPLETE_FORM,
    },
    {
        "name": "submit no business name",
        "current": 8,
        "previous": 8,
        "status": "submitted",
        "payload": with_changes(COMPLETE_FORM, businessName=" "),
    },
    {
        "name": "submit no services",
        "current": 8,
        "previous": 8,
        "status": "submitted",
        "payload": with_changes(COMPLETE_FORM, servicesOffered=[]),
    },
    {
        "name": "submit unknown services",
        "current": 8,
        "previous": 8,
        "status": "submitted",
        "payload": with_changes(COMPLETE_FORM, servicesOffered=["juggling"]),
    },
    {
        "name": "submit no country",
        "current": 8,
        "previous": 8,
        "status": "submitted",
        "payload": with_changes(COMPLETE_FORM, countryCode=None),
    },
    {
        "name": "submit no profile photo",
        "current": 8,
        "previous": 8,
        "status": "submitted",
        "payload": with_changes(COMPLETE_FORM, profileImageUrl=None),
    },
]

PHONES = [
    "",
    "   ",
    "07700 900123",
    "0770090012",
    "077009001234",
    "+44 7700 900123",
    "+1 555 0100",
    "+123456789012345",
    "+1234567890123456",
    "1234567890",
    "(020) 7946 0958",
    "x" * 41,
    "phone",
]

BUSINESS_NAMES = ["  Ada's   Cakes ", "ADA'S\tCAKES", "", "   ", "Café  Déjà", "a\n\nb"]
BIOS = [
    "",
    "  short bio  ",
    " ".join(f"word{number}" for number in range(100)),
    " ".join(f"w{number}" for number in range(130)),
]
EXPLORE_PAYLOADS: list[dict[str, Any]] = [
    {},
    COMPLETE_FORM,
    {"country_code": "gb", "baseCity": "   ", "servicesOffered": "baking"},
    {"countryCode": "FR", "hourlyRate": "80", "servicesOffered": ["DJ", " ", "mc", "dj"]},
    {"dailyRate": "1234.567", "baseCity": 12},
]

VISIBILITY_ROWS: list[dict[str, Any]] = [
    {},
    {"approval_status": "approved"},
    {
        "approval_status": "approved",
        "stripe_account_id": "acct_1",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    },
    {"approval_status": "approved", "stripe_account_id": "acct_1", "stripe_charges_enabled": True},
    {"approval_status": "approved", "listing_override": "visible"},
    {"approval_status": "approved", "listing_override": " VISIBLE "},
    {
        "approval_status": "approved",
        "listing_override": "hidden",
        "stripe_account_id": "acct_1",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
    },
    {"approval_status": "pending", "listing_override": "visible"},
    {"approval_status": "banned", "listing_override": "visible"},
    {"approval_status": "approved", "listing_override": "weird"},
    {"approval_status": "approved", "listing_override": None, "stripe_account_id": ""},
]

MEDIA_PAYLOADS: list[dict[str, Any]] = [
    {"name": "empty", "payload": {}},
    {"name": "portfolio only", "payload": {"portfolioFileNames": PORTFOLIO[:3]}},
    {
        "name": "profile and portfolio",
        "payload": {"profileImageUrl": PROFILE_PHOTO, "portfolioFileNames": PORTFOLIO[:3]},
    },
    {
        "name": "profile also in portfolio",
        "payload": {"profileImageUrl": PORTFOLIO[1], "portfolioFileNames": PORTFOLIO[:3]},
    },
    {
        "name": "stored order partial",
        "payload": {
            "profileImageUrl": PROFILE_PHOTO,
            "portfolioFileNames": PORTFOLIO[:3],
            "listingDisplayOrder": [PORTFOLIO[2], "https://gone.example/x.jpg"],
            "listingHiddenImageUrls": [PROFILE_PHOTO],
        },
    },
    {
        "name": "legacy cover",
        "payload": {
            "profileImageUrl": PROFILE_PHOTO,
            "portfolioFileNames": PORTFOLIO[:3],
            "listingCoverImageUrl": PORTFOLIO[1],
        },
    },
    {
        "name": "all hidden",
        "payload": {"portfolioFileNames": PORTFOLIO[:2], "listingHiddenImageUrls": PORTFOLIO[:2]},
    },
]

MEDIA_BASE = {
    "profileImageUrl": PROFILE_PHOTO,
    "portfolioFileNames": PORTFOLIO[:3],
    "listingCoverImageUrl": PORTFOLIO[0],
}
DEFAULT_ORDER = [PROFILE_PHOTO, *PORTFOLIO[:3]]
MEDIA_UPDATES: list[dict[str, Any]] = [
    {"name": "clear", "order": [], "hidden": []},
    {"name": "default order", "order": DEFAULT_ORDER, "hidden": []},
    {"name": "default order with hidden", "order": DEFAULT_ORDER, "hidden": [PORTFOLIO[0]]},
    {"name": "custom order", "order": [PORTFOLIO[2], " " + PORTFOLIO[0], PORTFOLIO[2], ""], "hidden": []},
    {"name": "hidden only", "order": [], "hidden": [PROFILE_PHOTO, PROFILE_PHOTO]},
    {"name": "foreign in order", "order": ["https://elsewhere.example/x.jpg"], "hidden": []},
    {"name": "foreign in hidden", "order": [PORTFOLIO[0]], "hidden": ["https://elsewhere.example/x.jpg"]},
]


def admin_media_update(payload: dict[str, Any], order: list[str], hidden: list[str]) -> dict[str, Any]:
    """The baseline admin update's payload changes, with its database reads and writes replaced."""
    saved: dict[str, Any] = {}

    class FakeTable:
        """Stands in for `get_db().table("vendors")`, recording the updated payload."""

        def update(self, row: dict[str, Any]) -> FakeTable:
            """Record the written payload."""
            saved.update(row)
            return self

        def eq(self, *_: Any) -> FakeTable:
            """Accept the user filter."""
            return self

        def execute(self) -> None:
            """Do nothing."""

    class FakeDb:
        """Stands in for the Supabase client."""

        def table(self, _: str) -> FakeTable:
            """The vendors table."""
            return FakeTable()

    listing_media.get_db = FakeDb
    listing_media.get_vendor_profile = lambda _: {"payload": copy.deepcopy(payload)}
    try:
        listing_media.update_vendor_listing_media(USER_ID, order, hidden)
    except ValueError as error:
        return {"error": str(error)}
    return {"payload": saved["payload"]}


def main(golden_root: Path) -> None:
    """Write every vendors golden file."""
    output = golden_root / "vendors"
    output.mkdir(parents=True, exist_ok=True)

    def write(name: str, data: Any) -> None:
        """Write one golden file as sorted, indented JSON."""
        (output / f"{name}.json").write_text(
            json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    write(
        "profile_normalize",
        {
            "user_id": USER_ID,
            "upload_host": HOST,
            "cases": [
                {**case, "normalized": normalize_payload_fields(copy.deepcopy(case["payload"]), USER_ID)}
                for case in NORMALIZE_CASES
            ],
        },
    )
    write(
        "profile_steps",
        [
            {
                **case,
                "steps": {
                    str(step): outcome(
                        lambda step=step, case=case: validate_step_fields(
                            step, copy.deepcopy(case["payload"])
                        )
                    )
                    for step in range(1, 9)
                },
            }
            for case in STEP_CASES
        ],
    )
    progress_results = []
    for case in PROGRESS_CASES:
        payload = copy.deepcopy(case["payload"])
        result = outcome(
            lambda payload=payload, case=case: validate_payload_for_progress(
                current_step=case["current"],
                previous_step=case["previous"],
                payload=payload,
                status=case["status"],
            )
        )
        progress_results.append({**case, "result": result, "services_after": payload.get("servicesOffered")})
    write("profile_progress", progress_results)
    write("phones", [{"phone": phone, "valid": is_valid_phone_number(phone)} for phone in PHONES])
    write(
        "business_names",
        [
            {
                "name": name,
                "normalized": normalize_business_name(name),
                "from_payload": business_name_from_payload({"businessName": name}),
            }
            for name in BUSINESS_NAMES
        ],
    )
    write("bios", [{"bio": bio, "clamped": _clamp_bio_words(bio)} for bio in BIOS])
    write(
        "explore_patches",
        [
            {"payload": payload, "patch": explore_search_patch_from_payload(payload)}
            for payload in EXPLORE_PAYLOADS
        ],
    )
    write(
        "visibility",
        [
            {
                "row": row,
                "override": listing_override_of(row),
                "payouts_verified": vendor_payouts_verified(row),
                "listable": row_is_publicly_listable(row),
            }
            for row in VISIBILITY_ROWS
        ],
    )
    write(
        "listing_media",
        {
            "public": [
                {
                    **case,
                    "urls": listing_media.public_listing_image_urls_from_payload(case["payload"]),
                    "cover": listing_media.listing_cover_image_url_from_payload(case["payload"]),
                    "default_order": listing_media.default_listing_display_order(case["payload"]),
                    "state": listing_media.listing_media_state_from_row({"payload": case["payload"]}),
                }
                for case in MEDIA_PAYLOADS
            ],
            "updates": [
                {**case, "base": MEDIA_BASE, **admin_media_update(MEDIA_BASE, case["order"], case["hidden"])}
                for case in MEDIA_UPDATES
            ],
        },
    )


if __name__ == "__main__":
    main(Path(sys.argv[1]))
