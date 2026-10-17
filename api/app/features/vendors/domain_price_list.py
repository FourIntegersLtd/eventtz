"""Vendor list prices: packages, rates, discounts, and booking line items. Pure.

Ported from the baseline `backend/app/features/vendors/list_pricing.py`, byte-identical in
behaviour (pinned by `api/tests/golden/test_price_list_goldens.py`). Two kinds of caller use
this module differently:

- **Profile validation** (vendor onboarding): raises `ProfileInvalid` for a bad field, so the
  web app can show it next to the step that needs fixing.
- **Booking line items** (`resolve_line_items` and its private helpers): raises `ValueError`,
  the same as the baseline, because these run inside a booking request rather than a profile
  save and the caller (the bookings slice) expects that type. This is a baseline
  quirk kept on purpose — see `AGENTS.md` "Fix root causes", but this is behaviour parity, not
  a bug.

The user-facing copy is the baseline's `messages.py`, kept verbatim as module constants and
helper functions here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any

from app.features.vendors.errors import ProfileInvalid

# --- user-facing copy (verbatim from backend/app/features/vendors/messages.py) ------------------

SELECT_PACKAGE_OR_RATE = "Select at least one package or rate."
DUPLICATE_PACKAGE_OR_RATE = "Duplicate package or rate selected."
PACKAGES_NO_LONGER_AVAILABLE = "One or more selected packages or rates are no longer available."
NO_PUBLISHED_PRICES = "This vendor has no published prices for your selection."
QUOTE_ONLY_NO_PRICED_OPTIONS = "This vendor only accepts quote requests - no priced options to select."
PER_UNIT_QUANTITY_REQUIRED = "Choose how many you need for each priced-per-item package."
LINE_TOTAL_TOO_HIGH = "That quantity takes this package over the maximum price."


def quantity_out_of_range(heading: str, min_quantity: int, max_quantity: int | None) -> str:
    """The message for a chosen quantity outside a per-unit package's allowed range."""
    name = heading.strip() or "this package"
    if max_quantity is None:
        return f"Choose at least {min_quantity} for {name}."
    return f"Choose between {min_quantity} and {max_quantity} for {name}."


def step_pricing_label_required(label: str) -> str:
    """The message for a required pricing field left blank."""
    return f"Step pricing: {label} is required."


def step_pricing_label_valid_amount(label: str) -> str:
    """The message for a pricing field that could not be read as any amount."""
    return f"Step pricing: {label} must be a valid amount."


def step_pricing_label_min_gbp(label: str, min_gbp: float) -> str:
    """The message for a pricing field below the minimum allowed amount."""
    return f"Step pricing: {label} must be at least £{min_gbp:.2f}."


def step_pricing_label_out_of_range(label: str) -> str:
    """The message for a pricing field above the maximum allowed amount."""
    return f"Step pricing: {label} is out of allowed range."


def step_pricing_label_single_amount(label: str) -> str:
    """The message for a pricing field that is not one plain number."""
    return f"Step pricing: {label} must be a single number (e.g. 150 or 150.00)."


def step_pricing_label_one_amount_only(label: str) -> str:
    """The message for a pricing field that looks like it holds more than one amount."""
    return f"Step pricing: {label} must be one amount only. Add a separate package for each price."


def step_pricing_label_no_range_price(label: str) -> str:
    """The message for a pricing field that looks like a range or a "starts from" price."""
    return f"Step pricing: {label} must be one fixed amount, not a range or “starts from” price."


# --- constants -----------------------------------------------------------------------------------

AUTO_BULK_LINE_ID = "auto-bulk"
AUTO_OFF_PEAK_LINE_ID = "auto-off-peak"

MIN_MONEY_GBP = 0.1
MAX_MONEY_GBP = 1_000_000.0

PRICING_MODE_FIXED = "fixed"
PRICING_MODE_PER_UNIT = "per_unit"
MAX_PACKAGE_QUANTITY = 100_000
MAX_PACKAGE_UNIT_LABEL_CHARS = 40
_QUANTITY_DIGITS_RE = re.compile(r"^[0-9]+$")


def parse_pricing_mode(raw_mode: Any) -> str:
    """`per_unit` when the vendor chose that mode; `fixed` for anything else (including blank)."""
    if isinstance(raw_mode, str) and raw_mode.strip().lower() == PRICING_MODE_PER_UNIT:
        return PRICING_MODE_PER_UNIT
    return PRICING_MODE_FIXED


def parse_quantity_input(raw_quantity: Any) -> tuple[int | None, bool]:
    """A whole-number quantity from `raw_quantity`. Return `(value, invalid)`; empty is `(None, False)`."""
    if raw_quantity is None:
        return None, False
    if isinstance(raw_quantity, bool):
        return None, True
    if isinstance(raw_quantity, int):
        if raw_quantity < 1 or raw_quantity > MAX_PACKAGE_QUANTITY:
            return None, True
        return raw_quantity, False
    if isinstance(raw_quantity, float):
        if not raw_quantity.is_integer():
            return None, True
        whole_quantity = int(raw_quantity)
        if whole_quantity < 1 or whole_quantity > MAX_PACKAGE_QUANTITY:
            return None, True
        return whole_quantity, False
    trimmed_quantity = str(raw_quantity).strip()
    if not trimmed_quantity:
        return None, False
    if not _QUANTITY_DIGITS_RE.fullmatch(trimmed_quantity):
        return None, True
    parsed_quantity = int(trimmed_quantity)
    if parsed_quantity < 1 or parsed_quantity > MAX_PACKAGE_QUANTITY:
        return None, True
    return parsed_quantity, False


def _coerce_str(payload: dict[str, Any], key: str) -> str:
    """`payload[key]` as a string: numbers and booleans stringify, anything else blanks."""
    raw_value = payload.get(key)
    if raw_value is None:
        return ""
    if isinstance(raw_value, str):
        return raw_value
    if isinstance(raw_value, (int, float, bool)):
        return str(raw_value)
    return ""


def parse_money_gbp(raw_amount: str | None) -> float | None:
    """A non-negative amount under £1bn from free text, keeping only digits and the decimal point."""
    if raw_amount is None or not isinstance(raw_amount, str):
        return None
    digits_only = re.sub(r"[^0-9.]", "", raw_amount.strip())
    if not digits_only:
        return None
    try:
        amount = float(digits_only)
        return amount if amount >= 0 and amount < 1e9 else None
    except ValueError:
        return None


_MULTIPLE_AMOUNT_SEPARATOR_RE = re.compile(r"[,;/|]")
_AMBIGUOUS_PRICE_RE = re.compile(
    r"\b("
    r"starts?\s+from|from\s+£|from\s+\d|price\s+on\s+request|\bpoa\b|\btbc\b|"
    r"£?\s*\d+(?:\.\d+)?\s*[-–—]\s*£?\s*\d+|\d+\s+(?:and|or)\s+\d+"
    r")\b",
    re.I,
)
_SINGLE_GBP_AMOUNT_RE = re.compile(
    r"^(?:£|gbp\s*)?\s*(\d+(?:\.\d{1,2})?)\s*$",
    re.I,
)


class SingleMoneyErrorKind(StrEnum):
    """Why a field failed to read as one fixed GBP amount."""

    REQUIRED = "required"
    MULTIPLE_AMOUNTS = "multiple_amounts"
    AMBIGUOUS = "ambiguous"
    INVALID_FORMAT = "invalid_format"
    BELOW_MIN = "below_min"
    ABOVE_MAX = "above_max"


def validate_single_money_gbp_kind(
    raw_amount: str | None,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> SingleMoneyErrorKind | None:
    """Return an error kind when the value is not one fixed GBP amount, else `None`."""
    if raw_amount is None or not isinstance(raw_amount, str):
        return SingleMoneyErrorKind.REQUIRED if required else None
    trimmed_amount = raw_amount.strip()
    if not trimmed_amount:
        return SingleMoneyErrorKind.REQUIRED if required else None
    if _MULTIPLE_AMOUNT_SEPARATOR_RE.search(trimmed_amount):
        return SingleMoneyErrorKind.MULTIPLE_AMOUNTS
    if _AMBIGUOUS_PRICE_RE.search(trimmed_amount):
        return SingleMoneyErrorKind.AMBIGUOUS
    match = _SINGLE_GBP_AMOUNT_RE.match(trimmed_amount)
    if not match:
        return SingleMoneyErrorKind.INVALID_FORMAT
    try:
        amount = float(match.group(1))
    except ValueError:
        return SingleMoneyErrorKind.INVALID_FORMAT
    if amount < min_gbp:
        return SingleMoneyErrorKind.BELOW_MIN
    if amount > max_gbp:
        return SingleMoneyErrorKind.ABOVE_MAX
    return None


def single_money_validation_message(kind: SingleMoneyErrorKind, label: str, *, min_gbp: float = 0.1) -> str:
    """The user-facing message for a `SingleMoneyErrorKind`."""
    if kind is SingleMoneyErrorKind.REQUIRED:
        return step_pricing_label_required(label)
    if kind is SingleMoneyErrorKind.MULTIPLE_AMOUNTS:
        return step_pricing_label_one_amount_only(label)
    if kind is SingleMoneyErrorKind.AMBIGUOUS:
        return step_pricing_label_no_range_price(label)
    if kind is SingleMoneyErrorKind.INVALID_FORMAT:
        return step_pricing_label_single_amount(label)
    if kind is SingleMoneyErrorKind.BELOW_MIN:
        return step_pricing_label_min_gbp(label, min_gbp)
    if kind is SingleMoneyErrorKind.ABOVE_MAX:
        return step_pricing_label_out_of_range(label)
    return step_pricing_label_valid_amount(label)


def raise_if_invalid_single_money_gbp(
    raw_amount: str | None,
    label: str,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> None:
    """Raise `ProfileInvalid` when the value is not one fixed GBP amount."""
    kind = validate_single_money_gbp_kind(
        raw_amount,
        required=required,
        min_gbp=min_gbp,
        max_gbp=max_gbp,
    )
    if kind is not None:
        raise ProfileInvalid(single_money_validation_message(kind, label, min_gbp=min_gbp))


def validate_single_money_gbp(
    raw_amount: str | None,
    label: str,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> str | None:
    """Return a user-facing error message (without the "Step pricing: " prefix) or `None`."""
    kind = validate_single_money_gbp_kind(
        raw_amount,
        required=required,
        min_gbp=min_gbp,
        max_gbp=max_gbp,
    )
    if kind is None:
        return None
    full_message = single_money_validation_message(kind, label, min_gbp=min_gbp)
    prefix = "Step pricing: "
    return full_message[len(prefix) :] if full_message.startswith(prefix) else full_message


def parse_single_money_gbp(raw_amount: str | None) -> float | None:
    """The amount in `raw_amount` when it reads as one fixed GBP amount, else `None`."""
    if validate_single_money_gbp_kind(raw_amount) is not None:
        return None
    if raw_amount is None or not isinstance(raw_amount, str):
        return None
    match = _SINGLE_GBP_AMOUNT_RE.match(raw_amount.strip())
    if not match:
        return None
    try:
        amount = float(match.group(1))
    except ValueError:
        return None
    return amount if amount >= 0 and amount < 1e9 else None


@dataclass(frozen=True)
class VendorDiscountConfig:
    """The vendor's discount settings from the pricing step of their profile."""

    offer_discounts: bool
    discount_pct: float
    discount_label: str
    bulk_threshold: float | None
    bulk_pct: float | None
    off_peak_pct: float | None


def parse_vendor_discount_config(payload: dict[str, Any]) -> VendorDiscountConfig:
    """Read the discount settings out of a vendor profile payload."""
    return VendorDiscountConfig(
        offer_discounts=payload.get("offerDiscounts") is True,
        discount_pct=parse_money_gbp(_coerce_str(payload, "discountPercentage")) or 0.0,
        discount_label=_coerce_str(payload, "discountLabel").strip(),
        bulk_threshold=parse_single_money_gbp(_coerce_str(payload, "bulkDiscountThreshold")),
        bulk_pct=parse_money_gbp(_coerce_str(payload, "bulkDiscountPercent")),
        off_peak_pct=parse_money_gbp(_coerce_str(payload, "offPeakDiscountPercent")),
    )


def has_active_list_discount(config: VendorDiscountConfig) -> bool:
    """True when the vendor's headline list discount is switched on and between 0 and 100%."""
    return config.offer_discounts and 0 < config.discount_pct < 100


def sale_price_after_discount(list_price: float, discount_pct: float) -> float:
    """`list_price` reduced by `discount_pct`, or unchanged when the percentage is out of range."""
    if discount_pct <= 0 or discount_pct >= 100:
        return list_price
    return round(list_price * (1 - discount_pct / 100), 2)


def unit_price_from_list(list_price: float, config: VendorDiscountConfig) -> float:
    """The price a client sees: discounted when the headline list discount is active."""
    if has_active_list_discount(config):
        return sale_price_after_discount(list_price, config.discount_pct)
    return round(list_price, 2)


def is_off_peak_date(event_date: date) -> bool:
    """Platform off-peak window: 1 Nov through last day of Feb (UK winter)."""
    month = event_date.month
    return month == 11 or month == 12 or month == 1 or month == 2


def _format_discount_pct(discount_pct: float) -> str:
    """A percentage for a discount label: whole numbers show without a decimal point."""
    rounded_pct = round(discount_pct * 100) / 100
    if rounded_pct == int(rounded_pct):
        return f"{int(rounded_pct)}%"
    return f"{rounded_pct}%"


@dataclass(frozen=True)
class RawPackage:
    """One package entry from the vendor profile payload, cleaned but not yet validated."""

    id: str
    title: str
    details: str
    price: str
    duration: str
    pricing_mode: str
    unit_label: str
    min_quantity: int | None
    max_quantity: int | None


def _normalize_packages(payload: dict[str, Any]) -> list[RawPackage]:
    """Every package in `payload["packages"]` that is a dict, cleaned into a `RawPackage`."""
    raw_packages = payload.get("packages")
    if not isinstance(raw_packages, list):
        return []
    normalized_packages: list[RawPackage] = []
    for index, item in enumerate(raw_packages):
        if not isinstance(item, dict):
            continue
        package_id = _coerce_str(item, "id").strip() or f"package-{index}"
        min_quantity, min_invalid = parse_quantity_input(item.get("minQuantity"))
        max_quantity, max_invalid = parse_quantity_input(item.get("maxQuantity"))
        normalized_packages.append(
            RawPackage(
                id=package_id,
                title=_coerce_str(item, "title").strip(),
                details=_coerce_str(item, "details").strip(),
                price=_coerce_str(item, "price").strip(),
                duration=_coerce_str(item, "duration").strip(),
                pricing_mode=parse_pricing_mode(item.get("pricingMode")),
                unit_label=_coerce_str(item, "unitLabel").strip()[:MAX_PACKAGE_UNIT_LABEL_CHARS],
                min_quantity=None if min_invalid else min_quantity,
                max_quantity=None if max_invalid else max_quantity,
            ),
        )
    return normalized_packages


def _package_qty_bounds_ok(package: RawPackage) -> bool:
    """True when a per-unit package's quantity bounds make sense (fixed packages always pass)."""
    if package.pricing_mode != PRICING_MODE_PER_UNIT:
        return True
    if not package.unit_label:
        return False
    lower_bound = package.min_quantity if package.min_quantity is not None else 1
    upper_bound = package.max_quantity
    if lower_bound < 1:
        return False
    return not (upper_bound is not None and upper_bound < lower_bound)


def _is_complete_package(package: RawPackage) -> bool:
    """True when a package has enough filled in to be shown to clients as a priced option."""
    details = package.details.strip()
    if not (package.title and package.price and len(details) >= 40):
        return False
    return _package_qty_bounds_ok(package)


def _services_feature_lines(payload: dict[str, Any]) -> list[str]:
    """Up to six non-blank service names, used as bullet points under a pricing option."""
    raw_services = payload.get("servicesOffered")
    if not isinstance(raw_services, list):
        return []
    return [str(service_name).strip() for service_name in raw_services if str(service_name).strip()][:6]


def _package_description(package: RawPackage) -> str:
    """The trimmed details text shown under a pricing option built from a package."""
    return package.details.strip()


@dataclass(frozen=True)
class PricingOption:
    """One thing a client can select: a package, an hourly/daily rate, or "request a quote"."""

    id: str
    heading: str
    unit_price_gbp: float | None
    description: str
    feature_lines: list[str]
    timeline_line: str | None
    pricing_mode: str = PRICING_MODE_FIXED
    unit_label: str | None = None
    min_quantity: int = 1
    max_quantity: int | None = None


def build_pricing_options(payload: dict[str, Any]) -> list[PricingOption]:
    """Packages and rates a client can choose from the vendor profile."""
    config = parse_vendor_discount_config(payload)
    service_lines = _services_feature_lines(payload)
    complete_packages = [package for package in _normalize_packages(payload) if _is_complete_package(package)]

    if complete_packages:
        options: list[PricingOption] = []
        for package in complete_packages:
            list_price = parse_single_money_gbp(package.price)
            unit_price = unit_price_from_list(list_price, config) if list_price is not None else None
            min_quantity = package.min_quantity if package.min_quantity is not None else 1
            options.append(
                PricingOption(
                    id=package.id,
                    heading=package.title,
                    unit_price_gbp=unit_price,
                    description=_package_description(package),
                    feature_lines=service_lines,
                    timeline_line=package.duration.strip() or None,
                    pricing_mode=package.pricing_mode,
                    unit_label=package.unit_label or None,
                    min_quantity=min_quantity,
                    max_quantity=package.max_quantity,
                ),
            )
        return options

    hourly_rate = parse_single_money_gbp(_coerce_str(payload, "hourlyRate"))
    daily_rate = parse_single_money_gbp(_coerce_str(payload, "dailyRate"))
    options = []
    if hourly_rate is not None:
        options.append(
            PricingOption(
                id="fixed-hourly",
                heading="Hourly rate",
                unit_price_gbp=unit_price_from_list(hourly_rate, config),
                description=(
                    "Per-hour rate from this vendor's pricing step. "
                    "Scope, hours, and travel are confirmed when you enquire."
                ),
                feature_lines=service_lines,
                timeline_line=None,
            ),
        )
    if daily_rate is not None:
        options.append(
            PricingOption(
                id="fixed-daily",
                heading="Daily rate",
                unit_price_gbp=unit_price_from_list(daily_rate, config),
                description=(
                    "Per-day rate from this vendor's pricing step. "
                    "Coverage and travel are confirmed when you enquire."
                ),
                feature_lines=service_lines,
                timeline_line=None,
            ),
        )
    if options:
        return options

    return [
        PricingOption(
            id="quote",
            heading="Request a quote",
            unit_price_gbp=None,
            description=(
                "This vendor has not published package prices or fixed hourly/daily rates yet. "
                "Send an enquiry to discuss your event."
            ),
            feature_lines=service_lines,
            timeline_line=None,
        ),
    ]


def _option_to_line_item(option: PricingOption, quantity: int) -> dict[str, Any]:
    """A priced line item for a chosen option and quantity, in the baseline's booking shape."""
    rate = option.unit_price_gbp
    line_total = None if rate is None else round(rate * quantity, 2)
    item: dict[str, Any] = {
        "id": option.id,
        "heading": option.heading,
        "unit_price_gbp": line_total,
        "description": option.description,
        "feature_lines": list(option.feature_lines),
        "timeline_line": option.timeline_line,
    }
    if option.pricing_mode == PRICING_MODE_PER_UNIT:
        item["quantity"] = quantity
        item["unit_rate_gbp"] = rate
        item["unit_label"] = option.unit_label
    return item


def _quantity_for_option(
    option: PricingOption,
    quantities: dict[str, int] | None,
) -> int:
    """The client-chosen quantity for a per-unit option (always 1 for a fixed option).

    Raises `ValueError`, matching the baseline: this runs inside a booking request, not a
    profile save, so the caller (bookings) is not expecting a `ProfileInvalid`.
    """
    if option.pricing_mode != PRICING_MODE_PER_UNIT:
        return 1
    quantity: int | None = None
    if quantities:
        raw_quantity = quantities.get(option.id)
        if raw_quantity is not None:
            try:
                quantity = int(raw_quantity)
            except (TypeError, ValueError):
                quantity = None
    if quantity is None:
        raise ValueError(PER_UNIT_QUANTITY_REQUIRED)
    min_quantity = option.min_quantity if option.min_quantity >= 1 else 1
    if quantity < min_quantity or (option.max_quantity is not None and quantity > option.max_quantity):
        raise ValueError(
            quantity_out_of_range(option.heading, min_quantity, option.max_quantity),
        )
    return quantity


def resolve_line_items(
    payload: dict[str, Any],
    selected_option_ids: list[str],
    quantities: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """
    Check selected package or rate ids against the vendor profile and return priced line items
    with the headline list discount applied. Bulk and off-peak discounts are added separately.
    Per-unit packages multiply the discounted unit rate by the client-chosen quantity.

    Raises `ValueError` on every rejection, matching the baseline: this is called from a
    booking request, not a profile save, so callers are not expecting `ProfileInvalid`.
    """
    if not selected_option_ids:
        raise ValueError(SELECT_PACKAGE_OR_RATE)

    seen_ids: set[str] = set()
    unique_ids: list[str] = []
    for raw_id in selected_option_ids:
        trimmed_id = str(raw_id).strip()
        if not trimmed_id:
            continue
        if trimmed_id in seen_ids:
            raise ValueError(DUPLICATE_PACKAGE_OR_RATE)
        seen_ids.add(trimmed_id)
        unique_ids.append(trimmed_id)

    if not unique_ids:
        raise ValueError(SELECT_PACKAGE_OR_RATE)

    options = build_pricing_options(payload)
    options_by_id = {option.id: option for option in options}

    line_items: list[dict[str, Any]] = []
    for option_id in unique_ids:
        option = options_by_id.get(option_id)
        if option is None:
            raise ValueError(PACKAGES_NO_LONGER_AVAILABLE)
        quantity = _quantity_for_option(option, quantities)
        item = _option_to_line_item(option, quantity)
        total = item.get("unit_price_gbp")
        if isinstance(total, (int, float)) and total > MAX_MONEY_GBP:
            raise ValueError(LINE_TOTAL_TOO_HIGH)
        line_items.append(item)

    has_priced_selection = any(line_item.get("unit_price_gbp") is not None for line_item in line_items)
    has_quote_only = len(options) == 1 and options[0].id == "quote"

    if not has_priced_selection and not has_quote_only:
        raise ValueError(NO_PUBLISHED_PRICES)

    if has_quote_only and unique_ids != ["quote"]:
        raise ValueError(QUOTE_ONLY_NO_PRICED_OPTIONS)

    return line_items


def _sum_positive_line_items(line_items: list[dict[str, Any]]) -> float:
    """The subtotal of priced (non-automatic, positive) line items, rounded to the penny."""
    total = 0.0
    for line_item in line_items:
        if not isinstance(line_item, dict):
            continue
        line_id = str(line_item.get("id") or "")
        if line_id.startswith("auto-"):
            continue
        raw_price = line_item.get("unit_price_gbp")
        if raw_price is None:
            continue
        try:
            price = float(raw_price)
        except (TypeError, ValueError):
            continue
        if price > 0:
            total += price
    return round(total, 2)


def compute_automatic_discount_lines(
    payload: dict[str, Any],
    line_items: list[dict[str, Any]],
    event_date: date,
) -> list[dict[str, Any]]:
    """
    Return 0-2 extra line items (negative amounts) for bulk and off-peak discounts.
    Applied after the headline list discount; bulk is calculated before off-peak.
    """
    config = parse_vendor_discount_config(payload)
    if not config.offer_discounts:
        return []

    subtotal = _sum_positive_line_items(line_items)
    if subtotal <= 0:
        return []

    auto_lines: list[dict[str, Any]] = []
    remaining = subtotal

    if (
        config.bulk_threshold is not None
        and config.bulk_threshold > 0
        and config.bulk_pct is not None
        and config.bulk_pct > 0
        and subtotal >= config.bulk_threshold
    ):
        bulk_reduction = round(remaining * (config.bulk_pct / 100), 2)
        if bulk_reduction > 0:
            auto_lines.append(
                {
                    "id": AUTO_BULK_LINE_ID,
                    "heading": f"Bulk booking discount ({_format_discount_pct(config.bulk_pct)})",
                    "unit_price_gbp": -bulk_reduction,
                    "description": None,
                    "feature_lines": [],
                    "timeline_line": None,
                },
            )
            remaining = round(remaining - bulk_reduction, 2)

    if (
        config.off_peak_pct is not None
        and config.off_peak_pct > 0
        and is_off_peak_date(event_date)
        and remaining > 0
    ):
        off_peak_reduction = round(remaining * (config.off_peak_pct / 100), 2)
        if off_peak_reduction > 0:
            auto_lines.append(
                {
                    "id": AUTO_OFF_PEAK_LINE_ID,
                    "heading": f"Off-peak discount ({_format_discount_pct(config.off_peak_pct)})",
                    "unit_price_gbp": -off_peak_reduction,
                    "description": None,
                    "feature_lines": [],
                    "timeline_line": None,
                },
            )

    return auto_lines


def strip_automatic_discount_lines(line_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove auto bulk and off-peak discount rows before recalculating discounts."""
    kept_lines: list[dict[str, Any]] = []
    for line_item in line_items:
        if not isinstance(line_item, dict):
            continue
        line_id = str(line_item.get("id") or "")
        if line_id.startswith("auto-"):
            continue
        kept_lines.append(line_item)
    return kept_lines


def reconcile_automatic_discount_lines(
    line_items: list[dict[str, Any]],
    payload: dict[str, Any],
    event_date: date,
) -> list[dict[str, Any]]:
    """Priced line items plus freshly calculated bulk and off-peak discount rows."""
    base_lines = strip_automatic_discount_lines(line_items)
    return base_lines + compute_automatic_discount_lines(payload, base_lines, event_date)


def min_listing_price_gbp(payload: dict[str, Any]) -> float | None:
    """Lowest sale price after the headline list discount only (not bulk or off-peak)."""
    options = build_pricing_options(payload)
    prices = [option.unit_price_gbp for option in options if option.unit_price_gbp is not None]
    if not prices:
        return None
    return min(prices)
