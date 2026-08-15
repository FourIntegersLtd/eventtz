"""Package completeness rules for vendor onboarding — mirror frontend packageQuality.ts."""

from __future__ import annotations

import re
from typing import Any

from app.core.errors import ValidationError
from app.features.vendors import messages as vendor_messages

MIN_PACKAGE_DESCRIPTION_CHARS = 40
MIN_PACKAGE_TITLE_CHARS = 3
RECOMMENDED_PACKAGE_DESCRIPTION_CHARS = 80

SERVICES_REQUIRING_PACKAGES = frozenset({"catering", "baking", "makeup"})

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
    return bool(title or price or details or duration)


def has_vague_package_description(details: str) -> bool:
    return bool(_VAGUE_DESCRIPTION_RE.search(details.strip()))


def is_complete_package(pkg: dict[str, Any]) -> bool:
    title = _coerce_str(pkg.get("title")).strip()
    price = _coerce_str(pkg.get("price")).strip()
    details = _coerce_str(pkg.get("details")).strip()
    if len(title) < MIN_PACKAGE_TITLE_CHARS:
        return False
    if not price:
        return False
    return len(details) >= MIN_PACKAGE_DESCRIPTION_CHARS


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
    if not title or len(title) < MIN_PACKAGE_TITLE_CHARS:
        raise ValidationError(vendor_messages.PACKAGE_NEEDS_CLEAR_NAME)
    if not price:
        raise ValidationError(vendor_messages.PACKAGE_NEEDS_PRICE)
    if strict or price:
        if len(details) < MIN_PACKAGE_DESCRIPTION_CHARS:
            raise ValidationError(vendor_messages.PACKAGE_DETAILS_TOO_SHORT)


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
