"""Check and tidy vendor onboarding fields - per step when advancing, and on every profile save."""

from __future__ import annotations

import re
from typing import Any

from app.core.errors import ValidationError
from app.core.phone_validation import is_valid_phone_number
from app.features.media.s3 import is_our_s3_url, public_object_url
from app.features.vendors import messages as vendor_messages
from app.features.vendors.markets import DEFAULT_COUNTRY_CODE, is_market_enabled, normalize_country_code
from app.features.vendors.list_pricing import (
    MAX_MONEY_GBP,
    MAX_PACKAGE_UNIT_LABEL_CHARS,
    MIN_MONEY_GBP,
    parse_money_gbp,
    parse_pricing_mode,
    parse_quantity_input,
    parse_single_money_gbp,
    raise_if_invalid_single_money_gbp,
)
from app.features.vendors.package_quality import (
    validate_package_fields,
    validate_packages_for_payload,
)
from app.features.vendors.taxonomy import filter_service_keys

MAX_DISCOUNT_PCT = 100.0
MIN_MAX_BOOKINGS_PER_DAY = 1
MAX_MAX_BOOKINGS_PER_DAY = 20
MIN_PORTFOLIO_IMAGES = 5
MAX_PORTFOLIO_IMAGES = 20

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
    n = parse_single_money_gbp(raw)
    if n is None:
        return raw.strip()
    clamped = max(0.0, min(MAX_MONEY_GBP, n))
    if clamped == int(clamped):
        return str(int(clamped))
    s = f"{clamped:.2f}".rstrip("0").rstrip(".")
    return s


def _is_allowed_storage_url(url: str, user_id: str) -> bool:
    u = url.strip()
    if not u.startswith("https://") and not u.startswith("http://"):
        return False
    if f"/users/{user_id}/" not in u:
        return False
    return is_our_s3_url(u)


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
    """Limit out-of-range values and drop unsafe upload URLs on every profile save."""
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
            pkg["pricingMode"] = parse_pricing_mode(pkg.get("pricingMode"))
            pkg["unitLabel"] = _coerce_str(pkg, "unitLabel").strip()[:MAX_PACKAGE_UNIT_LABEL_CHARS]
            min_qty, min_invalid = parse_quantity_input(pkg.get("minQuantity"))
            max_qty, max_invalid = parse_quantity_input(pkg.get("maxQuantity"))
            if min_qty is not None:
                pkg["minQuantity"] = str(min_qty)
            elif not min_invalid:
                pkg["minQuantity"] = ""
            if max_qty is not None:
                pkg["maxQuantity"] = str(max_qty)
            elif not max_invalid:
                pkg["maxQuantity"] = ""
            cleaned.append(pkg)
        out["packages"] = cleaned

    out["maxBookingsPerDay"] = str(_parse_max_bookings(_coerce_str(out, "maxBookingsPerDay")))

    out["portfolioFileNames"] = _filter_url_list(out.get("portfolioFileNames"), user_id)
    out["listingHiddenImageUrls"] = _filter_url_list(out.get("listingHiddenImageUrls"), user_id)
    out["listingDisplayOrder"] = _filter_url_list(out.get("listingDisplayOrder"), user_id)
    out.pop("listingTailImageUrls", None)
    videos = out.get("portfolioVideoNamesPersisted")
    legacy_video = _coerce_str(out, "portfolioVideoNamePersisted").strip()
    if not isinstance(videos, list):
        videos = []
    if legacy_video:
        videos = [legacy_video, *[v for v in videos if v != legacy_video]]
    out["portfolioVideoNamesPersisted"] = _filter_url_list(videos, user_id)
    out["portfolioVideoNamePersisted"] = ""
    labels = out.get("uploadedFileLabels")
    if isinstance(labels, dict):
        cleaned_labels: dict[str, str] = {}
        for key, value in labels.items():
            if isinstance(key, str) and isinstance(value, str) and value.strip():
                cleaned_labels[key.strip()] = value.strip()[:200]
        out["uploadedFileLabels"] = cleaned_labels
    for key in (
        "foodHygieneCertNamePersisted",
        "indemnityCertNamePersisted",
        "profileImageUrl",
        "listingCoverImageUrl",
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
        raise ValidationError(vendor_messages.step_pricing_label_valid_number(label))
    if n < 0 or n > MAX_DISCOUNT_PCT:
        raise ValidationError(vendor_messages.step_pricing_label_between_pct(label))


def _money_in_range(raw: str, label: str, *, required: bool = False) -> None:
    raise_if_invalid_single_money_gbp(
        raw,
        label,
        required=required,
        min_gbp=MIN_MONEY_GBP,
        max_gbp=MAX_MONEY_GBP,
    )


def _validate_step_location(payload: dict[str, Any]) -> None:
    country = normalize_country_code(_coerce_str(payload, "countryCode"))
    if not is_market_enabled(country):
        raise ValidationError(vendor_messages.STEP_LOCATION_SUPPORTED_COUNTRY)
    if not _coerce_str(payload, "baseCity").strip():
        raise ValidationError(vendor_messages.STEP_LOCATION_BASE_CITY_REQUIRED)
    modes = payload.get("deliveryModes")
    if not isinstance(modes, list) or not any(str(x).strip() for x in modes):
        raise ValidationError(vendor_messages.STEP_LOCATION_DELIVERY_OPTION)
    if not _coerce_str(payload, "travelRadius").strip():
        raise ValidationError(vendor_messages.STEP_LOCATION_TRAVEL_RADIUS)
    policy = _coerce_str(payload, "travelDeliveryPolicy").strip()
    if not policy:
        raise ValidationError(vendor_messages.STEP_LOCATION_TRAVEL_POLICY)
    if policy == "custom" and not _coerce_str(payload, "travelDeliveryPolicyCustomText").strip():
        raise ValidationError(vendor_messages.STEP_LOCATION_CUSTOM_TRAVEL_RULE)


def _validate_offer_discounts(payload: dict[str, Any]) -> None:
    if not payload.get("offerDiscounts"):
        return
    if not _coerce_str(payload, "discountLabel").strip():
        raise ValidationError(vendor_messages.STEP_PRICING_DISCOUNT_NAME_REQUIRED)
    has_list = bool(_coerce_str(payload, "discountPercentage").strip())
    bulk_threshold = _coerce_str(payload, "bulkDiscountThreshold").strip()
    bulk_pct = _coerce_str(payload, "bulkDiscountPercent").strip()
    has_bulk = bool(bulk_threshold and bulk_pct)
    has_off_peak = bool(_coerce_str(payload, "offPeakDiscountPercent").strip())
    if not has_list and not has_bulk and not has_off_peak:
        raise ValidationError(vendor_messages.STEP_PRICING_DISCOUNT_OPTION_REQUIRED)
    if (bulk_threshold and not bulk_pct) or (bulk_pct and not bulk_threshold):
        raise ValidationError(vendor_messages.STEP_PRICING_BULK_DISCOUNT_THRESHOLD_AND_PCT)


def _validate_step_account(payload: dict[str, Any]) -> None:
    if not _coerce_str(payload, "firstName").strip():
        raise ValidationError(vendor_messages.STEP_ACCOUNT_FIRST_NAME_REQUIRED)
    if not _coerce_str(payload, "lastName").strip():
        raise ValidationError(vendor_messages.STEP_ACCOUNT_LAST_NAME_REQUIRED)
    phone = _coerce_str(payload, "phone").strip()
    if not phone:
        raise ValidationError(vendor_messages.STEP_ACCOUNT_PHONE_REQUIRED)
    if not is_valid_phone_number(phone):
        raise ValidationError(vendor_messages.STEP_ACCOUNT_PHONE_INVALID)


def validate_step_fields(step: int, payload: dict[str, Any]) -> None:
    """Check the given onboarding step (1-8). Raises ValidationError if anything is invalid."""
    if step == 1:
        _validate_step_account(payload)
    elif step == 4:
        _money_in_range(_coerce_str(payload, "hourlyRate"), "Hourly rate")
        _money_in_range(_coerce_str(payload, "dailyRate"), "Daily rate")
        pkgs = payload.get("packages")
        if isinstance(pkgs, list):
            for pkg in pkgs:
                if isinstance(pkg, dict):
                    validate_package_fields(pkg, strict=True)
        validate_packages_for_payload(payload, on_submit=False, require_service_packages=True)
        has_rate = bool(_coerce_str(payload, "hourlyRate").strip()) or bool(
            _coerce_str(payload, "dailyRate").strip(),
        )
        has_pkg = isinstance(pkgs, list) and any(
            isinstance(p, dict) and _coerce_str(p, "price").strip() for p in pkgs
        )
        if not has_rate and not has_pkg:
            raise ValidationError(vendor_messages.STEP_PRICING_RATE_OR_PACKAGE)
        if payload.get("offerDiscounts"):
            _validate_offer_discounts(payload)
            _pct_in_range(_coerce_str(payload, "discountPercentage"), "List discount")
            _pct_in_range(_coerce_str(payload, "bulkDiscountPercent"), "Bulk discount")
            _pct_in_range(_coerce_str(payload, "offPeakDiscountPercent"), "Off-peak discount")
            _money_in_range(_coerce_str(payload, "bulkDiscountThreshold"), "Bulk threshold")

    elif step == 5:
        weekdays = payload.get("availableWeekdays")
        if not isinstance(weekdays, list) or len(weekdays) == 0:
            raise ValidationError(vendor_messages.STEP_AVAILABILITY_WEEKDAY)
        n = _parse_max_bookings(_coerce_str(payload, "maxBookingsPerDay"))
        raw = _coerce_str(payload, "maxBookingsPerDay").strip()
        if raw:
            parsed = parse_money_gbp(raw)
            if parsed is None or parsed < MIN_MAX_BOOKINGS_PER_DAY or parsed > MAX_MAX_BOOKINGS_PER_DAY:
                raise ValidationError(
                    vendor_messages.step_availability_max_bookings_range(
                        MIN_MAX_BOOKINGS_PER_DAY,
                        MAX_MAX_BOOKINGS_PER_DAY,
                    ),
                )
        if n < MIN_MAX_BOOKINGS_PER_DAY:
            raise ValidationError(vendor_messages.STEP_AVAILABILITY_MAX_BOOKINGS_MIN)

    elif step == 6:
        names = payload.get("portfolioFileNames")
        count = len(names) if isinstance(names, list) else 0
        if count < MIN_PORTFOLIO_IMAGES:
            raise ValidationError(
                vendor_messages.step_portfolio_min_images_required(MIN_PORTFOLIO_IMAGES),
            )
        if count > MAX_PORTFOLIO_IMAGES:
            raise ValidationError(
                vendor_messages.step_portfolio_max_images(MAX_PORTFOLIO_IMAGES),
            )

    elif step == 3:
        _validate_step_location(payload)

    elif step == 7:
        pass  # optional documents; upload URLs are cleaned on save

    elif step in (2, 8):
        pass  # frontend checks these steps; server re-checks on submit


def validate_payload_for_progress(
    *,
    current_step: int,
    previous_step: int,
    payload: dict[str, Any],
    status: str | None,
) -> None:
    """
    When the vendor moves forward, check the step they just finished.
    On submit, check every step (1-8).
    """
    st = (status or "").strip().lower()
    if st in ("submitted", "complete"):
        for s in range(1, 9):
            validate_step_fields(s, payload)
        if not _coerce_str(payload, "businessName").strip():
            raise ValidationError(vendor_messages.BUSINESS_NAME_REQUIRED_BEFORE_SUBMIT)
        _validate_step_account(payload)
        if not _coerce_str(payload, "countryCode").strip():
            payload = {**payload, "countryCode": DEFAULT_COUNTRY_CODE}
        _validate_step_location(payload)
        if not _coerce_str(payload, "baseCity").strip():
            raise ValidationError(vendor_messages.BASE_CITY_REQUIRED_BEFORE_SUBMIT)
        svcs = payload.get("servicesOffered")
        if not isinstance(svcs, list) or not any(str(x).strip() for x in svcs):
            raise ValidationError(vendor_messages.SELECT_SERVICE_BEFORE_SUBMIT)
        allowed = filter_service_keys([str(x) for x in svcs])
        if not allowed:
            raise ValidationError(vendor_messages.INVALID_SERVICE_OFFERED)
        payload["servicesOffered"] = allowed
        validate_packages_for_payload(payload, on_submit=True)
        return

    if current_step > previous_step and previous_step >= 1:
        for step in range(previous_step, current_step):
            validate_step_fields(step, payload)


def vendor_storage_url_prefix(user_id: str) -> str:
    """Public URL path segment for this vendor's uploads (new files on S3)."""
    return public_object_url(f"users/{user_id}/")
