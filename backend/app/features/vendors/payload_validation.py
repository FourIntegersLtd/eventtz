"""Validate and normalize vendor onboarding payload fields (step-scoped + always-on clamp)."""

from __future__ import annotations

import re
from typing import Any

from app.core.config import get_settings
from app.core.errors import ValidationError
from app.core.markets import DEFAULT_COUNTRY_CODE, is_market_enabled, normalize_country_code
from app.features.vendors.list_pricing import parse_money_gbp

MAX_DISCOUNT_PCT = 100.0
MAX_MONEY_GBP = 1_000_000.0
MIN_MAX_BOOKINGS_PER_DAY = 1
MAX_MAX_BOOKINGS_PER_DAY = 20

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _coerce_str(payload: dict[str, Any], key: str) -> str:
    v = payload.get(key)
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float, bool)):
        return str(v)
    return ""


def _clamp_pct(raw: str) -> str:
    n = parse_money_gbp(raw)
    if n is None:
        return ""
    clamped = max(0.0, min(MAX_DISCOUNT_PCT, n))
    if clamped == int(clamped):
        return str(int(clamped))
    return str(clamped)


def _clamp_money_str(raw: str) -> str:
    n = parse_money_gbp(raw)
    if n is None:
        return ""
    clamped = max(0.0, min(MAX_MONEY_GBP, n))
    if clamped == int(clamped):
        return str(int(clamped))
    s = f"{clamped:.2f}".rstrip("0").rstrip(".")
    return s


def _is_allowed_storage_url(url: str, user_id: str) -> bool:
    u = url.strip()
    if not u.startswith("https://") and not u.startswith("http://"):
        return False
    if "/storage/v1/object/public/" not in u:
        return False
    needle = f"/users/{user_id}/"
    return needle in u


def _filter_url_list(raw: Any, user_id: str) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw[:25]:
        if not isinstance(item, str):
            continue
        u = item.strip()
        if not u or u in seen:
            continue
        if _is_allowed_storage_url(u, user_id):
            seen.add(u)
            out.append(u)
    return out


def _parse_max_bookings(raw: str) -> int:
    n = parse_money_gbp(raw)
    if n is None:
        return MIN_MAX_BOOKINGS_PER_DAY
    return max(MIN_MAX_BOOKINGS_PER_DAY, min(MAX_MAX_BOOKINGS_PER_DAY, int(n)))


def normalize_payload_fields(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    """Clamp/strip dangerous fields on every profile save."""
    out = dict(payload)

    if not out.get("offerDiscounts"):
        out["discountPercentage"] = ""
        out["discountLabel"] = ""
        out["bulkDiscountThreshold"] = ""
        out["bulkDiscountPercent"] = ""
        out["offPeakDiscountPercent"] = ""
    else:
        out["discountPercentage"] = _clamp_pct(_coerce_str(out, "discountPercentage"))
        out["bulkDiscountPercent"] = _clamp_pct(_coerce_str(out, "bulkDiscountPercent"))
        out["offPeakDiscountPercent"] = _clamp_pct(_coerce_str(out, "offPeakDiscountPercent"))
        out["bulkDiscountThreshold"] = _clamp_money_str(_coerce_str(out, "bulkDiscountThreshold"))

    for key in ("hourlyRate", "dailyRate"):
        if key in out:
            out[key] = _clamp_money_str(_coerce_str(out, key))

    pkgs = out.get("packages")
    if isinstance(pkgs, list):
        cleaned: list[dict[str, Any]] = []
        for item in pkgs:
            if not isinstance(item, dict):
                continue
            pkg = dict(item)
            pkg["price"] = _clamp_money_str(_coerce_str(pkg, "price"))
            cleaned.append(pkg)
        out["packages"] = cleaned

    out["maxBookingsPerDay"] = str(_parse_max_bookings(_coerce_str(out, "maxBookingsPerDay")))

    out["portfolioFileNames"] = _filter_url_list(out.get("portfolioFileNames"), user_id)
    for key in (
        "portfolioVideoNamePersisted",
        "foodHygieneCertNamePersisted",
        "indemnityCertNamePersisted",
        "profileImageUrl",
    ):
        if key in out:
            v = _coerce_str(out, key).strip()
            out[key] = v if v and _is_allowed_storage_url(v, user_id) else ""

    other = out.get("otherDocsNamesPersisted")
    if other is not None:
        out["otherDocsNamesPersisted"] = _filter_url_list(other, user_id)

    blocked = out.get("blockedDates")
    if isinstance(blocked, list):
        out["blockedDates"] = [
            s
            for s in (_coerce_str({"d": x}, "d") for x in blocked)
            if _ISO_DATE.match(s[:10] if len(s) >= 10 else s)
        ]

    country_raw = _coerce_str(out, "countryCode").strip().upper()
    out["countryCode"] = normalize_country_code(country_raw or DEFAULT_COUNTRY_CODE)
    if _coerce_str(out, "region").strip():
        out["region"] = _coerce_str(out, "region").strip()[:120]
    else:
        out["region"] = ""
    if _coerce_str(out, "postalCode").strip():
        out["postalCode"] = _coerce_str(out, "postalCode").strip()[:32]
    else:
        out["postalCode"] = ""

    return out


def _pct_in_range(raw: str, label: str) -> None:
    if not raw.strip():
        return
    n = parse_money_gbp(raw)
    if n is None:
        raise ValidationError(f"Step pricing: {label} must be a valid number.")
    if n < 0 or n > MAX_DISCOUNT_PCT:
        raise ValidationError(f"Step pricing: {label} must be between 0 and 100%.")


def _money_in_range(raw: str, label: str, *, required: bool = False) -> None:
    if not raw.strip():
        if required:
            raise ValidationError(f"Step pricing: {label} is required.")
        return
    n = parse_money_gbp(raw)
    if n is None:
        raise ValidationError(f"Step pricing: {label} must be a valid amount.")
    if n < 0 or n > MAX_MONEY_GBP:
        raise ValidationError(f"Step pricing: {label} is out of allowed range.")


def _validate_step_location(payload: dict[str, Any]) -> None:
    country = normalize_country_code(_coerce_str(payload, "countryCode"))
    if not is_market_enabled(country):
        raise ValidationError("Step location: select a supported country.")
    if not _coerce_str(payload, "baseCity").strip():
        raise ValidationError("Step location: base city is required.")
    modes = payload.get("deliveryModes")
    if not isinstance(modes, list) or not any(str(x).strip() for x in modes):
        raise ValidationError("Step location: pick at least one delivery option.")
    if not _coerce_str(payload, "travelRadius").strip():
        raise ValidationError("Step location: select how far you travel.")
    policy = _coerce_str(payload, "travelDeliveryPolicy").strip()
    if not policy:
        raise ValidationError("Step location: select a travel / delivery policy.")
    if policy == "custom" and not _coerce_str(payload, "travelDeliveryPolicyCustomText").strip():
        raise ValidationError("Step location: describe your custom travel / delivery rule.")


def validate_step_fields(step: int, payload: dict[str, Any]) -> None:
    """Strict validation for the given onboarding step (1–8). Raises ValidationError."""
    if step == 4:
        _money_in_range(_coerce_str(payload, "hourlyRate"), "Hourly rate")
        _money_in_range(_coerce_str(payload, "dailyRate"), "Daily rate")
        pkgs = payload.get("packages")
        if isinstance(pkgs, list):
            for pkg in pkgs:
                if not isinstance(pkg, dict):
                    continue
                title = _coerce_str(pkg, "title").strip()
                price = _coerce_str(pkg, "price").strip()
                if title or price or _coerce_str(pkg, "details").strip():
                    if not title or not price:
                        raise ValidationError(
                            "Step pricing: each package needs a name and price.",
                        )
                    _money_in_range(price, "Package price", required=True)
        has_rate = bool(_coerce_str(payload, "hourlyRate").strip()) or bool(
            _coerce_str(payload, "dailyRate").strip(),
        )
        has_pkg = isinstance(pkgs, list) and any(
            isinstance(p, dict)
            and _coerce_str(p, "title").strip()
            and _coerce_str(p, "price").strip()
            for p in pkgs
        )
        if not has_rate and not has_pkg:
            raise ValidationError(
                "Step pricing: add at least one rate or a package price.",
            )
        if payload.get("offerDiscounts"):
            _pct_in_range(_coerce_str(payload, "discountPercentage"), "List discount")
            _pct_in_range(_coerce_str(payload, "bulkDiscountPercent"), "Bulk discount")
            _pct_in_range(_coerce_str(payload, "offPeakDiscountPercent"), "Off-peak discount")
            _money_in_range(_coerce_str(payload, "bulkDiscountThreshold"), "Bulk threshold")

    elif step == 5:
        weekdays = payload.get("availableWeekdays")
        if not isinstance(weekdays, list) or len(weekdays) == 0:
            raise ValidationError("Step availability: pick at least one weekday.")
        n = _parse_max_bookings(_coerce_str(payload, "maxBookingsPerDay"))
        raw = _coerce_str(payload, "maxBookingsPerDay").strip()
        if raw:
            parsed = parse_money_gbp(raw)
            if parsed is None or parsed < MIN_MAX_BOOKINGS_PER_DAY or parsed > MAX_MAX_BOOKINGS_PER_DAY:
                raise ValidationError(
                    f"Step availability: max bookings per day must be "
                    f"{MIN_MAX_BOOKINGS_PER_DAY}–{MAX_MAX_BOOKINGS_PER_DAY}.",
                )
        if n < MIN_MAX_BOOKINGS_PER_DAY:
            raise ValidationError("Step availability: set max bookings per day (min 1).")

    elif step == 6:
        names = payload.get("portfolioFileNames")
        count = len(names) if isinstance(names, list) else 0
        if count < 5:
            raise ValidationError("Step portfolio: upload at least 5 images.")
        if count > 20:
            raise ValidationError("Step portfolio: maximum 20 images.")

    elif step == 3:
        _validate_step_location(payload)

    elif step == 8:
        pass  # optional docs; URLs normalized on save

    elif step in (1, 2, 7):
        pass  # covered by existing frontend + minimal server checks on submit


def validate_payload_for_progress(
    *,
    current_step: int,
    previous_step: int,
    payload: dict[str, Any],
    status: str | None,
) -> None:
    """
    When advancing steps, validate the step being completed.
    When submitting, validate steps 1–8.
    """
    st = (status or "").strip().lower()
    if st in ("submitted", "complete"):
        for s in range(1, 9):
            validate_step_fields(s, payload)
        if not _coerce_str(payload, "businessName").strip():
            raise ValidationError("Business name is required before submit.")
        if not _coerce_str(payload, "countryCode").strip():
            payload = {**payload, "countryCode": DEFAULT_COUNTRY_CODE}
        _validate_step_location(payload)
        if not _coerce_str(payload, "baseCity").strip():
            raise ValidationError("Base city is required before submit.")
        svcs = payload.get("servicesOffered")
        if not isinstance(svcs, list) or not any(str(x).strip() for x in svcs):
            raise ValidationError("Select at least one service before submit.")
        return

    if current_step > previous_step and previous_step >= 1:
        for step in range(previous_step, current_step):
            validate_step_fields(step, payload)


def vendor_storage_url_prefix(user_id: str) -> str:
    """Public URL path segment for this vendor's uploads."""
    base = get_settings().supabase_url.rstrip("/")
    bucket = get_settings().media_images_bucket.strip() or "eventtz-images"
    return f"{base}/storage/v1/object/public/{bucket}/users/{user_id}/"
