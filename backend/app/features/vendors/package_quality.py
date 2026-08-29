"""Package completeness rules for vendor onboarding — mirror frontend packageQuality.ts."""

from __future__ import annotations

import re
from typing import Any

from app.core.errors import ValidationError
from app.features.vendors import messages as vendor_messages
from app.features.vendors.list_pricing import (
    MAX_PACKAGE_UNIT_LABEL_CHARS,
    PRICING_MODE_PER_UNIT,
    parse_pricing_mode,
    parse_quantity_input,
    parse_single_money_gbp,
    raise_if_invalid_single_money_gbp,
)

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
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    return ""


def is_configured_package(pkg: dict[str, Any]) -> bool:
    title = _coerce_str(pkg.get("title")).strip()
    price = _coerce_str(pkg.get("price")).strip()
    details = _coerce_str(pkg.get("details")).strip()
    duration = _coerce_str(pkg.get("duration")).strip()
    unit_label = _coerce_str(pkg.get("unitLabel")).strip()
    min_raw = _coerce_str(pkg.get("minQuantity")).strip()
    max_raw = _coerce_str(pkg.get("maxQuantity")).strip()
    per_unit = parse_pricing_mode(pkg.get("pricingMode")) == PRICING_MODE_PER_UNIT
    return bool(title or price or details or duration or unit_label or min_raw or max_raw or per_unit)


def has_vague_package_description(details: str) -> bool:
    return bool(_VAGUE_DESCRIPTION_RE.search(details.strip()))


def is_complete_package(pkg: dict[str, Any]) -> bool:
    title = _coerce_str(pkg.get("title")).strip()
    price = _coerce_str(pkg.get("price")).strip()
    details = _coerce_str(pkg.get("details")).strip()
    if len(title) < MIN_PACKAGE_TITLE_CHARS:
        return False
    if parse_single_money_gbp(price) is None:
        return False
    if len(details) < MIN_PACKAGE_DESCRIPTION_CHARS:
        return False
    if parse_pricing_mode(pkg.get("pricingMode")) == PRICING_MODE_PER_UNIT:
        unit_label = _coerce_str(pkg.get("unitLabel")).strip()
        if not unit_label or len(unit_label) > MAX_PACKAGE_UNIT_LABEL_CHARS:
            return False
        min_qty, min_invalid = parse_quantity_input(pkg.get("minQuantity"))
        max_qty, max_invalid = parse_quantity_input(pkg.get("maxQuantity"))
        if min_invalid or max_invalid:
            return False
        if min_qty is not None and max_qty is not None and min_qty > max_qty:
            return False
    return True


def services_requiring_packages(services: list[Any]) -> list[str]:
    out: list[str] = []
    for raw in services:
        key = str(raw).strip()
        if key in SERVICES_REQUIRING_PACKAGES:
            out.append(key)
    return out


def requires_at_least_one_package(payload: dict[str, Any]) -> bool:
    svcs = payload.get("servicesOffered")
    if not isinstance(svcs, list):
        return False
    return bool(services_requiring_packages(svcs))


def validate_package_fields(pkg: dict[str, Any], *, strict: bool = False) -> None:
    if not is_configured_package(pkg):
        return
    title = _coerce_str(pkg.get("title")).strip()
    price = _coerce_str(pkg.get("price")).strip()
    details = _coerce_str(pkg.get("details")).strip()
    per_unit = parse_pricing_mode(pkg.get("pricingMode")) == PRICING_MODE_PER_UNIT
    if not title or len(title) < MIN_PACKAGE_TITLE_CHARS:
        raise ValidationError(vendor_messages.PACKAGE_NEEDS_CLEAR_NAME)
    if not price:
        raise ValidationError(
            vendor_messages.PACKAGE_NEEDS_UNIT_PRICE if per_unit else vendor_messages.PACKAGE_NEEDS_PRICE,
        )
    raise_if_invalid_single_money_gbp(
        price,
        "Unit price" if per_unit else "Package price",
        required=True,
    )
    if strict or price:
        if len(details) < MIN_PACKAGE_DESCRIPTION_CHARS:
            raise ValidationError(vendor_messages.PACKAGE_DETAILS_TOO_SHORT)
    if per_unit:
        unit_label = _coerce_str(pkg.get("unitLabel")).strip()
        if not unit_label:
            raise ValidationError(vendor_messages.PACKAGE_NEEDS_UNIT_LABEL)
        if len(unit_label) > MAX_PACKAGE_UNIT_LABEL_CHARS:
            raise ValidationError(vendor_messages.PACKAGE_UNIT_LABEL_TOO_LONG)
        min_qty, min_invalid = parse_quantity_input(pkg.get("minQuantity"))
        max_qty, max_invalid = parse_quantity_input(pkg.get("maxQuantity"))
        if min_invalid:
            raise ValidationError(vendor_messages.PACKAGE_MIN_QTY_INVALID)
        if max_invalid:
            raise ValidationError(vendor_messages.PACKAGE_MAX_QTY_INVALID)
        if min_qty is not None and max_qty is not None and min_qty > max_qty:
            raise ValidationError(vendor_messages.PACKAGE_MIN_ABOVE_MAX)


def validate_packages_for_payload(
    payload: dict[str, Any],
    *,
    on_submit: bool = False,
    require_service_packages: bool = False,
) -> None:
    pkgs = payload.get("packages")
    if not isinstance(pkgs, list):
        pkgs = []
    for pkg in pkgs:
        if isinstance(pkg, dict):
            validate_package_fields(pkg, strict=on_submit or require_service_packages)

    if (on_submit or require_service_packages) and requires_at_least_one_package(payload):
        complete = [
            p for p in pkgs if isinstance(p, dict) and is_complete_package(p)
        ]
        if not complete:
            svcs = services_requiring_packages(payload.get("servicesOffered") or [])
            labels = ", ".join(svcs) or "your service"
            raise ValidationError(vendor_messages.complete_package_for_labels(labels))

    if on_submit and not _coerce_str(payload.get("profileImageUrl")).strip():
        raise ValidationError(vendor_messages.PROFILE_PHOTO_BEFORE_SUBMIT)


def count_complete_packages(payload: dict[str, Any]) -> tuple[int, int]:
    pkgs = payload.get("packages")
    if not isinstance(pkgs, list):
        return 0, 0
    configured = [p for p in pkgs if isinstance(p, dict) and is_configured_package(p)]
    complete = [p for p in configured if is_complete_package(p)]
    return len(complete), len(configured)


def package_quality_level(payload: dict[str, Any]) -> str:
    complete, total = count_complete_packages(payload)
    if total == 0:
        return "needs_review"
    if complete == total and complete > 0:
        return "high"
    return "needs_review"
