"""The vendor onboarding form: tidy it on every save, and check each step as the vendor moves on. Pure.

The form is one JSON document (`vendors.payload`, camelCase keys from the web app).
`normalize_payload_fields` runs on every save: it clamps numbers into range and drops
upload URLs that are not this vendor's own files in our bucket. The `validate_*`
functions raise `ProfileInvalid` with copy that names the step and the field to fix.

Upload URLs are checked against `upload_host`, the bucket's public host, which the
service reads from the `Storage` port so this module stays free of settings and I/O.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.features.vendors.domain_catalogue import (
    DEFAULT_COUNTRY_CODE,
    filter_service_keys,
    get_market,
    is_market_enabled,
    normalize_country_code,
)
from app.features.vendors.domain_packages import validate_package_fields, validate_packages_for_payload
from app.features.vendors.domain_price_list import (
    MAX_MONEY_GBP,
    MAX_PACKAGE_UNIT_LABEL_CHARS,
    MIN_MONEY_GBP,
    min_listing_price_gbp,
    parse_money_gbp,
    parse_pricing_mode,
    parse_quantity_input,
    parse_single_money_gbp,
    raise_if_invalid_single_money_gbp,
)
from app.features.vendors.errors import ProfileInvalid

MAX_DISCOUNT_PCT = 100.0
MIN_MAX_BOOKINGS_PER_DAY = 1
MAX_MAX_BOOKINGS_PER_DAY = 20
MIN_PORTFOLIO_IMAGES = 5
MAX_PORTFOLIO_IMAGES = 20
# The public bio is cut to this many words (with "…") when it is saved.
BIO_MAX_WORDS = 100
# At most this many URLs are kept from any one upload list.
_MAX_URLS_PER_LIST = 25
_MAX_FILE_LABEL_CHARS = 200
_MAX_REGION_CHARS = 120
_MAX_POSTAL_CODE_CHARS = 32
# The onboarding wizard has eight steps; submitting re-checks all of them.
ONBOARDING_STEPS = range(1, 9)

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_WHITESPACE_RUN = re.compile(r"\s+")

# Single-URL fields that must point at the vendor's own uploads (blanked otherwise).
_SINGLE_UPLOAD_FIELDS = (
    "foodHygieneCertNamePersisted",
    "indemnityCertNamePersisted",
    "profileImageUrl",
    "listingCoverImageUrl",
)

# --- copy (verbatim from the baseline) -------------------------------------------------------------

STEP_LOCATION_SUPPORTED_COUNTRY = "Step location: select a supported country."
STEP_LOCATION_BASE_CITY_REQUIRED = "Step location: base city is required."
STEP_LOCATION_DELIVERY_OPTION = "Step location: pick at least one delivery option."
STEP_LOCATION_TRAVEL_RADIUS = "Step location: select how far you travel."
STEP_LOCATION_TRAVEL_POLICY = "Step location: select a travel / delivery policy."
STEP_LOCATION_CUSTOM_TRAVEL_RULE = "Step location: describe your custom travel / delivery rule."
STEP_PRICING_DISCOUNT_NAME_REQUIRED = "Step pricing: discount name is required."
STEP_PRICING_DISCOUNT_OPTION_REQUIRED = "Step pricing: select at least one discount option."
STEP_PRICING_BULK_DISCOUNT_THRESHOLD_AND_PCT = (
    "Step pricing: bulk discount needs both a threshold and a percentage."
)
STEP_ACCOUNT_FIRST_NAME_REQUIRED = "Step account: first name is required."
STEP_ACCOUNT_LAST_NAME_REQUIRED = "Step account: last name is required."
STEP_ACCOUNT_PHONE_REQUIRED = "Step account: phone number is required."
STEP_ACCOUNT_PHONE_INVALID = (
    "Step account: enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx)."
)
STEP_PRICING_RATE_OR_PACKAGE = "Step pricing: add at least one rate or a package price."
STEP_AVAILABILITY_WEEKDAY = "Step availability: pick at least one weekday."
STEP_AVAILABILITY_MAX_BOOKINGS_MIN = "Step availability: set max bookings per day (min 1)."
BUSINESS_NAME_REQUIRED_BEFORE_SUBMIT = "Business name is required before submit."
BASE_CITY_REQUIRED_BEFORE_SUBMIT = "Base city is required before submit."
SELECT_SERVICE_BEFORE_SUBMIT = "Select at least one service before submit."
INVALID_SERVICE_OFFERED = "Select a valid service category before submit."


def _label_valid_number(label: str) -> str:
    """Copy for a percentage field that is not a number."""
    return f"Step pricing: {label} must be a valid number."


def _label_between_pct(label: str) -> str:
    """Copy for a percentage field outside 0-100."""
    return f"Step pricing: {label} must be between 0 and 100%."


def _max_bookings_range(lowest: int, highest: int) -> str:
    """Copy for a max-bookings-per-day value outside the allowed range."""
    return f"Step availability: max bookings per day must be {lowest}-{highest}."


def _portfolio_min_images(minimum: int) -> str:
    """Copy for too few portfolio images."""
    return f"Step portfolio: at least {minimum} images required."


def _portfolio_max_images(maximum: int) -> str:
    """Copy for too many portfolio images."""
    return f"Step portfolio: maximum {maximum} images."


# --- small readers -----------------------------------------------------------------------------------


def text_field(payload: dict[str, Any], key: str) -> str:
    """The field as text: strings as-is, numbers and booleans stringified, anything else empty."""
    value = payload.get(key)
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    return ""


def _clamp_pct(raw: str) -> str:
    """A percentage clamped to 0-100, written without a needless `.0`; empty when not a number."""
    number = parse_money_gbp(raw)
    if number is None:
        return ""
    clamped = max(0.0, min(MAX_DISCOUNT_PCT, number))
    if clamped == int(clamped):
        return str(int(clamped))
    return str(clamped)


def _clamp_money_text(raw: str) -> str:
    """A single amount clamped to 0..MAX_MONEY_GBP, at most 2 dp; unparseable text is kept (trimmed)."""
    number = parse_single_money_gbp(raw)
    if number is None:
        return raw.strip()
    clamped = max(0.0, min(MAX_MONEY_GBP, number))
    if clamped == int(clamped):
        return str(int(clamped))
    return f"{clamped:.2f}".rstrip("0").rstrip(".")


def _is_own_upload(url: str, user_id: str, upload_host: str) -> bool:
    """True for an http(s) URL in our bucket under this vendor's `/users/<id>/` folder."""
    trimmed = url.strip()
    if not trimmed.startswith(("https://", "http://")):
        return False
    if f"/users/{user_id}/" not in trimmed:
        return False
    return (urlparse(trimmed).netloc or "").lower() == upload_host.lower()


def _own_upload_list(raw: Any, user_id: str, upload_host: str) -> list[str]:
    """The vendor's own upload URLs from the first 25 items of `raw`, trimmed, no repeats."""
    if not isinstance(raw, list):
        return []
    kept: list[str] = []
    for item in raw[:_MAX_URLS_PER_LIST]:
        if not isinstance(item, str):
            continue
        url = item.strip()
        if url and url not in kept and _is_own_upload(url, user_id, upload_host):
            kept.append(url)
    return kept


def _max_bookings(raw: str) -> int:
    """Max bookings per day clamped into 1-20 (1 when blank or not a number)."""
    number = parse_money_gbp(raw)
    if number is None:
        return MIN_MAX_BOOKINGS_PER_DAY
    return max(MIN_MAX_BOOKINGS_PER_DAY, min(MAX_MAX_BOOKINGS_PER_DAY, int(number)))


# --- tidy on save --------------------------------------------------------------------------------------


def clamp_bio_words(text: str, max_words: int = BIO_MAX_WORDS) -> str:
    """The bio trimmed, cut to `max_words` words with a trailing "…" when it is longer."""
    words = text.strip().split()
    if len(words) <= max_words:
        return text.strip()
    return f"{' '.join(words[:max_words])}…"


def with_clamped_bio(payload: dict[str, Any]) -> dict[str, Any]:
    """A copy of the incoming form with `aiBioDraft` cut to the public bio length."""
    tidied = dict(payload)
    raw_bio = tidied.get("aiBioDraft")
    if isinstance(raw_bio, str) and raw_bio.strip():
        tidied["aiBioDraft"] = clamp_bio_words(raw_bio)
    return tidied


def _normalize_discounts(form: dict[str, Any]) -> None:
    """Blank every discount field when discounts are off; otherwise clamp them into range."""
    if not form.get("offerDiscounts"):
        for key in (
            "discountPercentage",
            "discountLabel",
            "bulkDiscountThreshold",
            "bulkDiscountPercent",
            "offPeakDiscountPercent",
        ):
            form[key] = ""
        return
    for key in ("discountPercentage", "bulkDiscountPercent", "offPeakDiscountPercent"):
        form[key] = _clamp_pct(text_field(form, key))
    form["bulkDiscountThreshold"] = _clamp_money_text(text_field(form, "bulkDiscountThreshold"))


def _normalize_package(raw_package: dict[str, Any]) -> dict[str, Any]:
    """One package with its price clamped, pricing mode and unit label tidied, quantities as text.

    An invalid quantity is left as typed so the step check can report it.
    """
    package = dict(raw_package)
    package["price"] = _clamp_money_text(text_field(package, "price"))
    package["pricingMode"] = parse_pricing_mode(package.get("pricingMode"))
    package["unitLabel"] = text_field(package, "unitLabel").strip()[:MAX_PACKAGE_UNIT_LABEL_CHARS]
    for key in ("minQuantity", "maxQuantity"):
        quantity, is_invalid = parse_quantity_input(package.get(key))
        if quantity is not None:
            package[key] = str(quantity)
        elif not is_invalid:
            package[key] = ""
    return package


def _normalize_uploads(form: dict[str, Any], user_id: str, upload_host: str) -> None:
    """Keep only the vendor's own upload URLs in every upload field, and tidy the file labels."""
    for key in ("portfolioFileNames", "listingHiddenImageUrls", "listingDisplayOrder"):
        form[key] = _own_upload_list(form.get(key), user_id, upload_host)
    form.pop("listingTailImageUrls", None)

    # Videos: the old single-video field is folded into the front of the list, then cleared.
    videos = form.get("portfolioVideoNamesPersisted")
    legacy_video = text_field(form, "portfolioVideoNamePersisted").strip()
    if not isinstance(videos, list):
        videos = []
    if legacy_video:
        videos = [legacy_video, *[video for video in videos if video != legacy_video]]
    form["portfolioVideoNamesPersisted"] = _own_upload_list(videos, user_id, upload_host)
    form["portfolioVideoNamePersisted"] = ""

    labels = form.get("uploadedFileLabels")
    if isinstance(labels, dict):
        form["uploadedFileLabels"] = {
            label_key.strip(): label.strip()[:_MAX_FILE_LABEL_CHARS]
            for label_key, label in labels.items()
            if isinstance(label_key, str) and isinstance(label, str) and label.strip()
        }

    for key in _SINGLE_UPLOAD_FIELDS:
        if key in form:
            url = text_field(form, key).strip()
            form[key] = url if url and _is_own_upload(url, user_id, upload_host) else ""

    other_documents = form.get("otherDocsNamesPersisted")
    if other_documents is not None:
        form["otherDocsNamesPersisted"] = _own_upload_list(other_documents, user_id, upload_host)


def _is_iso_date_text(text: str) -> bool:
    """True when the text starts with (or is) a `YYYY-MM-DD` date."""
    return bool(_ISO_DATE.match(text[:10] if len(text) >= 10 else text))


def normalize_payload_fields(payload: dict[str, Any], user_id: str, *, upload_host: str) -> dict[str, Any]:
    """A copy of the form with numbers clamped into range and foreign upload URLs dropped.

    Runs on every save, whatever step the vendor is on, so stored data is always in range.
    """
    form = dict(payload)
    _normalize_discounts(form)

    for key in ("hourlyRate", "dailyRate"):
        if key in form:
            form[key] = _clamp_money_text(text_field(form, key))

    packages = form.get("packages")
    if isinstance(packages, list):
        form["packages"] = [_normalize_package(package) for package in packages if isinstance(package, dict)]

    form["maxBookingsPerDay"] = str(_max_bookings(text_field(form, "maxBookingsPerDay")))
    _normalize_uploads(form, user_id, upload_host)

    blocked_dates = form.get("blockedDates")
    if isinstance(blocked_dates, list):
        date_texts = (text_field({"date": blocked_date}, "date") for blocked_date in blocked_dates)
        form["blockedDates"] = [date_text for date_text in date_texts if _is_iso_date_text(date_text)]

    country_code = text_field(form, "countryCode").strip().upper()
    form["countryCode"] = normalize_country_code(country_code or DEFAULT_COUNTRY_CODE)
    form["region"] = text_field(form, "region").strip()[:_MAX_REGION_CHARS]
    form["postalCode"] = text_field(form, "postalCode").strip()[:_MAX_POSTAL_CODE_CHARS]
    return form


# --- step checks -----------------------------------------------------------------------------------------


def is_valid_phone_number(phone: str) -> bool:
    """UK or international: `+` then 10-15 digits, `0` then 10-11 digits, else 10-15 digits (max 40 chars)."""
    trimmed = phone.strip()
    if not trimmed or len(trimmed) > 40:
        return False
    if trimmed.startswith("+"):
        return 10 <= len(re.sub(r"\D", "", trimmed[1:])) <= 15
    digit_count = len(re.sub(r"\D", "", trimmed))
    if trimmed.startswith("0"):
        return 10 <= digit_count <= 11
    return 10 <= digit_count <= 15


def _check_pct(raw: str, label: str) -> None:
    """A filled-in percentage must be a number between 0 and 100."""
    if not raw.strip():
        return
    number = parse_money_gbp(raw)
    if number is None:
        raise ProfileInvalid(_label_valid_number(label))
    if number < 0 or number > MAX_DISCOUNT_PCT:
        raise ProfileInvalid(_label_between_pct(label))


def _check_money(raw: str, label: str) -> None:
    """A filled-in amount must be one fixed price inside the allowed range."""
    raise_if_invalid_single_money_gbp(
        raw, label, required=False, min_gbp=MIN_MONEY_GBP, max_gbp=MAX_MONEY_GBP
    )


def _check_location(payload: dict[str, Any]) -> None:
    """Step 3: a supported country, a base city, delivery options, travel radius and policy."""
    if not is_market_enabled(normalize_country_code(text_field(payload, "countryCode"))):
        raise ProfileInvalid(STEP_LOCATION_SUPPORTED_COUNTRY)
    if not text_field(payload, "baseCity").strip():
        raise ProfileInvalid(STEP_LOCATION_BASE_CITY_REQUIRED)
    delivery_modes = payload.get("deliveryModes")
    if not isinstance(delivery_modes, list) or not any(str(mode).strip() for mode in delivery_modes):
        raise ProfileInvalid(STEP_LOCATION_DELIVERY_OPTION)
    if not text_field(payload, "travelRadius").strip():
        raise ProfileInvalid(STEP_LOCATION_TRAVEL_RADIUS)
    policy = text_field(payload, "travelDeliveryPolicy").strip()
    if not policy:
        raise ProfileInvalid(STEP_LOCATION_TRAVEL_POLICY)
    if policy == "custom" and not text_field(payload, "travelDeliveryPolicyCustomText").strip():
        raise ProfileInvalid(STEP_LOCATION_CUSTOM_TRAVEL_RULE)


def _check_offer_discounts(payload: dict[str, Any]) -> None:
    """With discounts on: a name, at least one kind of discount, and bulk needs threshold and percent."""
    if not payload.get("offerDiscounts"):
        return
    if not text_field(payload, "discountLabel").strip():
        raise ProfileInvalid(STEP_PRICING_DISCOUNT_NAME_REQUIRED)
    has_list_discount = bool(text_field(payload, "discountPercentage").strip())
    bulk_threshold = text_field(payload, "bulkDiscountThreshold").strip()
    bulk_pct = text_field(payload, "bulkDiscountPercent").strip()
    has_bulk_discount = bool(bulk_threshold and bulk_pct)
    has_off_peak_discount = bool(text_field(payload, "offPeakDiscountPercent").strip())
    if not (has_list_discount or has_bulk_discount or has_off_peak_discount):
        raise ProfileInvalid(STEP_PRICING_DISCOUNT_OPTION_REQUIRED)
    if bool(bulk_threshold) != bool(bulk_pct):
        raise ProfileInvalid(STEP_PRICING_BULK_DISCOUNT_THRESHOLD_AND_PCT)


def _check_account(payload: dict[str, Any]) -> None:
    """Step 1: first name, last name, and a valid phone number."""
    if not text_field(payload, "firstName").strip():
        raise ProfileInvalid(STEP_ACCOUNT_FIRST_NAME_REQUIRED)
    if not text_field(payload, "lastName").strip():
        raise ProfileInvalid(STEP_ACCOUNT_LAST_NAME_REQUIRED)
    phone = text_field(payload, "phone").strip()
    if not phone:
        raise ProfileInvalid(STEP_ACCOUNT_PHONE_REQUIRED)
    if not is_valid_phone_number(phone):
        raise ProfileInvalid(STEP_ACCOUNT_PHONE_INVALID)


def _check_pricing(payload: dict[str, Any]) -> None:
    """Step 4: valid rates and packages, at least one price, and sensible discounts."""
    _check_money(text_field(payload, "hourlyRate"), "Hourly rate")
    _check_money(text_field(payload, "dailyRate"), "Daily rate")
    packages = payload.get("packages")
    if isinstance(packages, list):
        for package in packages:
            if isinstance(package, dict):
                validate_package_fields(package, strict=True)
    validate_packages_for_payload(payload, on_submit=False, require_service_packages=True)
    has_rate = bool(text_field(payload, "hourlyRate").strip() or text_field(payload, "dailyRate").strip())
    has_priced_package = isinstance(packages, list) and any(
        isinstance(package, dict) and text_field(package, "price").strip() for package in packages
    )
    if not has_rate and not has_priced_package:
        raise ProfileInvalid(STEP_PRICING_RATE_OR_PACKAGE)
    if payload.get("offerDiscounts"):
        _check_offer_discounts(payload)
        _check_pct(text_field(payload, "discountPercentage"), "List discount")
        _check_pct(text_field(payload, "bulkDiscountPercent"), "Bulk discount")
        _check_pct(text_field(payload, "offPeakDiscountPercent"), "Off-peak discount")
        _check_money(text_field(payload, "bulkDiscountThreshold"), "Bulk threshold")


def _check_availability(payload: dict[str, Any]) -> None:
    """Step 5: at least one weekday, and max bookings per day within 1-20."""
    weekdays = payload.get("availableWeekdays")
    if not isinstance(weekdays, list) or not weekdays:
        raise ProfileInvalid(STEP_AVAILABILITY_WEEKDAY)
    raw_max = text_field(payload, "maxBookingsPerDay").strip()
    if raw_max:
        parsed_max = parse_money_gbp(raw_max)
        if parsed_max is None or not MIN_MAX_BOOKINGS_PER_DAY <= parsed_max <= MAX_MAX_BOOKINGS_PER_DAY:
            raise ProfileInvalid(_max_bookings_range(MIN_MAX_BOOKINGS_PER_DAY, MAX_MAX_BOOKINGS_PER_DAY))
    if _max_bookings(raw_max) < MIN_MAX_BOOKINGS_PER_DAY:
        raise ProfileInvalid(STEP_AVAILABILITY_MAX_BOOKINGS_MIN)


def _check_portfolio(payload: dict[str, Any]) -> None:
    """Step 6: between 5 and 20 portfolio images."""
    images = payload.get("portfolioFileNames")
    image_count = len(images) if isinstance(images, list) else 0
    if image_count < MIN_PORTFOLIO_IMAGES:
        raise ProfileInvalid(_portfolio_min_images(MIN_PORTFOLIO_IMAGES))
    if image_count > MAX_PORTFOLIO_IMAGES:
        raise ProfileInvalid(_portfolio_max_images(MAX_PORTFOLIO_IMAGES))


def validate_step_fields(step: int, payload: dict[str, Any]) -> None:
    """Check one onboarding step (1-8); raises `ProfileInvalid`.

    Steps 2 and 8 are checked by the web app (and again on submit); step 7's documents
    are optional, and their URLs are already cleaned on save.
    """
    if step == 1:
        _check_account(payload)
    elif step == 3:
        _check_location(payload)
    elif step == 4:
        _check_pricing(payload)
    elif step == 5:
        _check_availability(payload)
    elif step == 6:
        _check_portfolio(payload)


def validate_payload_for_progress(
    *, current_step: int, previous_step: int, payload: dict[str, Any], status: str | None
) -> None:
    """Check the steps the vendor just finished, or every step when they submit.

    On submit this also narrows `payload["servicesOffered"]` to the recognised keys, in place.
    """
    normalized_status = (status or "").strip().lower()
    if normalized_status in ("submitted", "complete"):
        for step in ONBOARDING_STEPS:
            validate_step_fields(step, payload)
        if not text_field(payload, "businessName").strip():
            raise ProfileInvalid(BUSINESS_NAME_REQUIRED_BEFORE_SUBMIT)
        _check_account(payload)
        if not text_field(payload, "countryCode").strip():
            # Baseline quirk kept for parity: from here on a copy is checked, so the services
            # narrowing below does not reach the caller. Saves never hit this: normalising
            # always fills in the country first.
            payload = {**payload, "countryCode": DEFAULT_COUNTRY_CODE}
        _check_location(payload)
        if not text_field(payload, "baseCity").strip():
            raise ProfileInvalid(BASE_CITY_REQUIRED_BEFORE_SUBMIT)
        services = payload.get("servicesOffered")
        if not isinstance(services, list) or not any(str(service).strip() for service in services):
            raise ProfileInvalid(SELECT_SERVICE_BEFORE_SUBMIT)
        known_services = filter_service_keys([str(service) for service in services])
        if not known_services:
            raise ProfileInvalid(INVALID_SERVICE_OFFERED)
        payload["servicesOffered"] = known_services
        validate_packages_for_payload(payload, on_submit=True)
        return

    if current_step > previous_step >= 1:
        for step in range(previous_step, current_step):
            validate_step_fields(step, payload)


# --- business name and search columns ------------------------------------------------------------------


def normalize_business_name(name: str) -> str:
    """The name as compared for uniqueness: trimmed, lower-cased, runs of spaces collapsed."""
    return _WHITESPACE_RUN.sub(" ", name.strip().lower())


def business_name_from_payload(payload: dict[str, Any]) -> str | None:
    """The form's normalised business name, or None when it is missing or blank."""
    raw_name = payload.get("businessName")
    if not isinstance(raw_name, str):
        return None
    return normalize_business_name(raw_name) or None


def explore_search_patch_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """The search columns stored beside the form so explore can filter without reading JSON."""
    country_code = normalize_country_code(
        str(payload.get("countryCode") or payload.get("country_code") or "")
    )
    min_price = min_listing_price_gbp(payload)
    base_city = payload.get("baseCity")
    raw_services = payload.get("servicesOffered")
    services = (
        filter_service_keys([str(service) for service in raw_services if str(service).strip()])
        if isinstance(raw_services, list)
        else []
    )
    return {
        "country_code": country_code,
        "currency": get_market(country_code).currency,
        "min_list_price_gbp": round(float(min_price), 2) if min_price is not None else None,
        "base_city_normalized": (
            base_city.strip().lower() if isinstance(base_city, str) and base_city.strip() else None
        ),
        "services_offered": services or None,
    }
