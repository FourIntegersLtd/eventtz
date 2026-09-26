"""Package completeness rules for vendor onboarding. Pure.

Ported from the baseline `backend/app/features/vendors/package_quality.py`, byte-identical in
behaviour (pinned by `api/tests/golden/test_price_list_goldens.py`) and mirroring the frontend's
`packageQuality.ts`. Every `ValidationError` the baseline raises here becomes `ProfileInvalid`:
these functions only ever run against a profile save, never a booking request.

The user-facing copy is the baseline's `messages.py`, kept verbatim as module constants and
helper functions here.
"""

from __future__ import annotations

import re
from typing import Any

from app.features.vendors.domain_price_list import (
    MAX_PACKAGE_UNIT_LABEL_CHARS,
    PRICING_MODE_PER_UNIT,
    parse_pricing_mode,
    parse_quantity_input,
    parse_single_money_gbp,
    raise_if_invalid_single_money_gbp,
)
from app.features.vendors.errors import ProfileInvalid

# --- user-facing copy (verbatim from backend/app/features/vendors/messages.py) ------------------

PACKAGE_NEEDS_CLEAR_NAME = "Step pricing: each package needs a clear name."
PACKAGE_NEEDS_PRICE = "Step pricing: each package needs a price."
PACKAGE_NEEDS_UNIT_PRICE = "Step pricing: each per-item package needs a unit price."
PACKAGE_NEEDS_UNIT_LABEL = "Step pricing: each per-item package needs a unit name (e.g. chair, table)."
PACKAGE_UNIT_LABEL_TOO_LONG = "Step pricing: keep the unit name short."
PACKAGE_MIN_QTY_INVALID = "Step pricing: minimum quantity must be a whole number of at least 1."
PACKAGE_MAX_QTY_INVALID = "Step pricing: maximum quantity must be a whole number of at least 1."
PACKAGE_MIN_ABOVE_MAX = "Step pricing: minimum quantity cannot be greater than maximum."
PACKAGE_DETAILS_TOO_SHORT = "Step pricing: tell clients what's included (at least a short sentence)."
PROFILE_PHOTO_BEFORE_SUBMIT = "Add a profile photo before submitting."


def complete_package_for_labels(labels: str) -> str:
    """The message asking for at least one complete package for the given service labels."""
    return f"Step pricing: add at least one complete package for {labels}."


# --- constants -------------------------------------------------------------------------------

MIN_PACKAGE_DESCRIPTION_CHARS = 40
MIN_PACKAGE_TITLE_CHARS = 3
RECOMMENDED_PACKAGE_DESCRIPTION_CHARS = 80

SERVICES_REQUIRING_PACKAGES = frozenset(
    {"catering", "baking", "makeup", "hair_styling", "decor", "event_planning"},
)

_VAGUE_DESCRIPTION_RE = re.compile(
    r"\b("
    r"ask the vendor|contact for|message us|pm for details|price on request|"
    r"\bpoa\b|\btbc\b|contact me|get in touch for|varies|enquire|inquire"
    r")\b",
    re.IGNORECASE,
)
_GENERIC_TITLE_RE = re.compile(r"^package\s*\d*$", re.IGNORECASE)


def _coerce_str(value: Any) -> str:
    """A field value as a string: numbers and booleans stringify, anything else blanks."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    return ""


def is_configured_package(package: dict[str, Any]) -> bool:
    """True when a package row has any field filled in at all (as opposed to a blank template row)."""
    title = _coerce_str(package.get("title")).strip()
    price = _coerce_str(package.get("price")).strip()
    details = _coerce_str(package.get("details")).strip()
    duration = _coerce_str(package.get("duration")).strip()
    unit_label = _coerce_str(package.get("unitLabel")).strip()
    min_quantity_text = _coerce_str(package.get("minQuantity")).strip()
    max_quantity_text = _coerce_str(package.get("maxQuantity")).strip()
    is_per_unit = parse_pricing_mode(package.get("pricingMode")) == PRICING_MODE_PER_UNIT
    return bool(
        title
        or price
        or details
        or duration
        or unit_label
        or min_quantity_text
        or max_quantity_text
        or is_per_unit,
    )


def has_vague_package_description(details: str) -> bool:
    """True when the package details read like a placeholder ("contact for price" and so on)."""
    return bool(_VAGUE_DESCRIPTION_RE.search(details.strip()))


def is_complete_package(package: dict[str, Any]) -> bool:
    """True when a package has everything needed to be shown to clients as a priced option."""
    title = _coerce_str(package.get("title")).strip()
    price = _coerce_str(package.get("price")).strip()
    details = _coerce_str(package.get("details")).strip()
    if len(title) < MIN_PACKAGE_TITLE_CHARS:
        return False
    if parse_single_money_gbp(price) is None:
        return False
    if len(details) < MIN_PACKAGE_DESCRIPTION_CHARS:
        return False
    if parse_pricing_mode(package.get("pricingMode")) == PRICING_MODE_PER_UNIT:
        unit_label = _coerce_str(package.get("unitLabel")).strip()
        if not unit_label or len(unit_label) > MAX_PACKAGE_UNIT_LABEL_CHARS:
            return False
        min_quantity, min_invalid = parse_quantity_input(package.get("minQuantity"))
        max_quantity, max_invalid = parse_quantity_input(package.get("maxQuantity"))
        if min_invalid or max_invalid:
            return False
        if min_quantity is not None and max_quantity is not None and min_quantity > max_quantity:
            return False
    return True


def services_requiring_packages(services: list[Any]) -> list[str]:
    """The services in `services` that require at least one complete package to go live."""
    required_services: list[str] = []
    for raw_service in services:
        service_key = str(raw_service).strip()
        if service_key in SERVICES_REQUIRING_PACKAGES:
            required_services.append(service_key)
    return required_services


def requires_at_least_one_package(payload: dict[str, Any]) -> bool:
    """True when the vendor's chosen services include one that requires a package."""
    services = payload.get("servicesOffered")
    if not isinstance(services, list):
        return False
    return bool(services_requiring_packages(services))


def validate_package_fields(package: dict[str, Any], *, strict: bool = False) -> None:
    """Raise `ProfileInvalid` for the first broken field in a configured package.

    A package with nothing filled in is skipped (nothing to validate yet). `strict=True`
    (on submit, or when the vendor's services require a package) also requires a full
    description; otherwise a description is only checked once a price has been entered.
    """
    if not is_configured_package(package):
        return
    title = _coerce_str(package.get("title")).strip()
    price = _coerce_str(package.get("price")).strip()
    details = _coerce_str(package.get("details")).strip()
    is_per_unit = parse_pricing_mode(package.get("pricingMode")) == PRICING_MODE_PER_UNIT
    if not title or len(title) < MIN_PACKAGE_TITLE_CHARS:
        raise ProfileInvalid(PACKAGE_NEEDS_CLEAR_NAME)
    if not price:
        raise ProfileInvalid(PACKAGE_NEEDS_UNIT_PRICE if is_per_unit else PACKAGE_NEEDS_PRICE)
    raise_if_invalid_single_money_gbp(
        price,
        "Unit price" if is_per_unit else "Package price",
        required=True,
    )
    if (strict or price) and len(details) < MIN_PACKAGE_DESCRIPTION_CHARS:
        raise ProfileInvalid(PACKAGE_DETAILS_TOO_SHORT)
    if is_per_unit:
        unit_label = _coerce_str(package.get("unitLabel")).strip()
        if not unit_label:
            raise ProfileInvalid(PACKAGE_NEEDS_UNIT_LABEL)
        if len(unit_label) > MAX_PACKAGE_UNIT_LABEL_CHARS:
            raise ProfileInvalid(PACKAGE_UNIT_LABEL_TOO_LONG)
        min_quantity, min_invalid = parse_quantity_input(package.get("minQuantity"))
        max_quantity, max_invalid = parse_quantity_input(package.get("maxQuantity"))
        if min_invalid:
            raise ProfileInvalid(PACKAGE_MIN_QTY_INVALID)
        if max_invalid:
            raise ProfileInvalid(PACKAGE_MAX_QTY_INVALID)
        if min_quantity is not None and max_quantity is not None and min_quantity > max_quantity:
            raise ProfileInvalid(PACKAGE_MIN_ABOVE_MAX)


def validate_packages_for_payload(
    payload: dict[str, Any],
    *,
    on_submit: bool = False,
    require_service_packages: bool = False,
) -> None:
    """Validate every package in the profile payload, and the submit-only whole-profile rules."""
    packages = payload.get("packages")
    if not isinstance(packages, list):
        packages = []
    for package in packages:
        if isinstance(package, dict):
            validate_package_fields(package, strict=on_submit or require_service_packages)

    if (on_submit or require_service_packages) and requires_at_least_one_package(payload):
        complete_packages = [
            package for package in packages if isinstance(package, dict) and is_complete_package(package)
        ]
        if not complete_packages:
            required_services = services_requiring_packages(payload.get("servicesOffered") or [])
            labels = ", ".join(required_services) or "your service"
            raise ProfileInvalid(complete_package_for_labels(labels))

    if on_submit and not _coerce_str(payload.get("profileImageUrl")).strip():
        raise ProfileInvalid(PROFILE_PHOTO_BEFORE_SUBMIT)


def count_complete_packages(payload: dict[str, Any]) -> tuple[int, int]:
    """`(complete_count, configured_count)` for the packages in the payload."""
    packages = payload.get("packages")
    if not isinstance(packages, list):
        return 0, 0
    configured_packages = [
        package for package in packages if isinstance(package, dict) and is_configured_package(package)
    ]
    complete_packages = [package for package in configured_packages if is_complete_package(package)]
    return len(complete_packages), len(configured_packages)


def package_quality_level(payload: dict[str, Any]) -> str:
    """`"high"` when every configured package is complete and there is at least one; else `"needs_review"`."""
    complete_count, total_count = count_complete_packages(payload)
    if total_count == 0:
        return "needs_review"
    if complete_count == total_count and complete_count > 0:
        return "high"
    return "needs_review"
