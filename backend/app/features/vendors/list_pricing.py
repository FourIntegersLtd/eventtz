"""Vendor list prices: packages, rates, discounts, and booking line items."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Any

from app.core.errors import ValidationError
from app.features.vendors import messages as vendor_messages

AUTO_BULK_LINE_ID = "auto-bulk"
AUTO_OFF_PEAK_LINE_ID = "auto-off-peak"

MIN_MONEY_GBP = 0.1
MAX_MONEY_GBP = 1_000_000.0


def _coerce_str(payload: dict[str, Any], key: str) -> str:
    v = payload.get(key)
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float, bool)):
        return str(v)
    return ""


def parse_money_gbp(raw: str | None) -> float | None:
    if raw is None or not isinstance(raw, str):
        return None
    t = re.sub(r"[^0-9.]", "", raw.strip())
    if not t:
        return None
    try:
        n = float(t)
        return n if n >= 0 and n < 1e9 else None
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


class SingleMoneyErrorKind(str, Enum):
    REQUIRED = "required"
    MULTIPLE_AMOUNTS = "multiple_amounts"
    AMBIGUOUS = "ambiguous"
    INVALID_FORMAT = "invalid_format"
    BELOW_MIN = "below_min"
    ABOVE_MAX = "above_max"


def validate_single_money_gbp_kind(
    raw: str | None,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> SingleMoneyErrorKind | None:
    """Return an error kind when the value is not one fixed GBP amount."""
    if raw is None or not isinstance(raw, str):
        return SingleMoneyErrorKind.REQUIRED if required else None
    trimmed = raw.strip()
    if not trimmed:
        return SingleMoneyErrorKind.REQUIRED if required else None
    if _MULTIPLE_AMOUNT_SEPARATOR_RE.search(trimmed):
        return SingleMoneyErrorKind.MULTIPLE_AMOUNTS
    if _AMBIGUOUS_PRICE_RE.search(trimmed):
        return SingleMoneyErrorKind.AMBIGUOUS
    match = _SINGLE_GBP_AMOUNT_RE.match(trimmed)
    if not match:
        return SingleMoneyErrorKind.INVALID_FORMAT
    try:
        n = float(match.group(1))
    except ValueError:
        return SingleMoneyErrorKind.INVALID_FORMAT
    if n < min_gbp:
        return SingleMoneyErrorKind.BELOW_MIN
    if n > max_gbp:
        return SingleMoneyErrorKind.ABOVE_MAX
    return None


def single_money_validation_message(kind: SingleMoneyErrorKind, label: str, *, min_gbp: float = 0.1) -> str:
    if kind is SingleMoneyErrorKind.REQUIRED:
        return vendor_messages.step_pricing_label_required(label)
    if kind is SingleMoneyErrorKind.MULTIPLE_AMOUNTS:
        return vendor_messages.step_pricing_label_one_amount_only(label)
    if kind is SingleMoneyErrorKind.AMBIGUOUS:
        return vendor_messages.step_pricing_label_no_range_price(label)
    if kind is SingleMoneyErrorKind.INVALID_FORMAT:
        return vendor_messages.step_pricing_label_single_amount(label)
    if kind is SingleMoneyErrorKind.BELOW_MIN:
        return vendor_messages.step_pricing_label_min_gbp(label, min_gbp)
    if kind is SingleMoneyErrorKind.ABOVE_MAX:
        return vendor_messages.step_pricing_label_out_of_range(label)
    return vendor_messages.step_pricing_label_valid_amount(label)


def raise_if_invalid_single_money_gbp(
    raw: str | None,
    label: str,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> None:
    kind = validate_single_money_gbp_kind(
        raw,
        required=required,
        min_gbp=min_gbp,
        max_gbp=max_gbp,
    )
    if kind is not None:
        raise ValidationError(single_money_validation_message(kind, label, min_gbp=min_gbp))


def validate_single_money_gbp(
    raw: str | None,
    label: str,
    *,
    required: bool = False,
    min_gbp: float = 0.1,
    max_gbp: float = 1_000_000.0,
) -> str | None:
    """Return a user-facing error message when the value is not one fixed GBP amount."""
    kind = validate_single_money_gbp_kind(
        raw,
        required=required,
        min_gbp=min_gbp,
        max_gbp=max_gbp,
    )
    if kind is None:
        return None
    full = single_money_validation_message(kind, label, min_gbp=min_gbp)
    prefix = "Step pricing: "
    return full[len(prefix) :] if full.startswith(prefix) else full


def parse_single_money_gbp(raw: str | None) -> float | None:
    if validate_single_money_gbp_kind(raw) is not None:
        return None
    if raw is None or not isinstance(raw, str):
        return None
    match = _SINGLE_GBP_AMOUNT_RE.match(raw.strip())
    if not match:
        return None
    try:
        n = float(match.group(1))
    except ValueError:
        return None
    return n if n >= 0 and n < 1e9 else None


@dataclass(frozen=True)
class VendorDiscountConfig:
    offer_discounts: bool
    discount_pct: float
    discount_label: str
    bulk_threshold: float | None
    bulk_pct: float | None
    off_peak_pct: float | None


def parse_vendor_discount_config(payload: dict[str, Any]) -> VendorDiscountConfig:
    return VendorDiscountConfig(
        offer_discounts=payload.get("offerDiscounts") is True,
        discount_pct=parse_money_gbp(_coerce_str(payload, "discountPercentage")) or 0.0,
        discount_label=_coerce_str(payload, "discountLabel").strip(),
        bulk_threshold=parse_single_money_gbp(_coerce_str(payload, "bulkDiscountThreshold")),
        bulk_pct=parse_money_gbp(_coerce_str(payload, "bulkDiscountPercent")),
        off_peak_pct=parse_money_gbp(_coerce_str(payload, "offPeakDiscountPercent")),
    )


def has_active_list_discount(config: VendorDiscountConfig) -> bool:
    return config.offer_discounts and 0 < config.discount_pct < 100


def sale_price_after_discount(list_price: float, pct: float) -> float:
    if pct <= 0 or pct >= 100:
        return list_price
    return round(list_price * (1 - pct / 100), 2)


def unit_price_from_list(list_price: float, config: VendorDiscountConfig) -> float:
    if has_active_list_discount(config):
        return sale_price_after_discount(list_price, config.discount_pct)
    return round(list_price, 2)


def is_off_peak_date(event_date: date) -> bool:
    """Platform off-peak window: 1 Nov through last day of Feb (UK winter)."""
    month = event_date.month
    return month == 11 or month == 12 or month == 1 or month == 2


def _format_discount_pct(pct: float) -> str:
    rounded = round(pct * 100) / 100
    if rounded == int(rounded):
        return f"{int(rounded)}%"
    return f"{rounded}%"


@dataclass(frozen=True)
class RawPackage:
    id: str
    title: str
    details: str
    price: str
    duration: str


def _normalize_packages(payload: dict[str, Any]) -> list[RawPackage]:
    raw = payload.get("packages")
    if not isinstance(raw, list):
        return []
    out: list[RawPackage] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        pid = _coerce_str(item, "id").strip() or f"package-{index}"
        out.append(
            RawPackage(
                id=pid,
                title=_coerce_str(item, "title").strip(),
                details=_coerce_str(item, "details").strip(),
                price=_coerce_str(item, "price").strip(),
                duration=_coerce_str(item, "duration").strip(),
            ),
        )
    return out


def _is_complete_package(pkg: RawPackage) -> bool:
    details = pkg.details.strip()
    return bool(pkg.title and pkg.price and len(details) >= 40)


def _services_feature_lines(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("servicesOffered")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip()][:6]


def _package_description(pkg: RawPackage) -> str:
    return pkg.details.strip()


@dataclass(frozen=True)
class PricingOption:
    id: str
    heading: str
    unit_price_gbp: float | None
    description: str
    feature_lines: list[str]
    timeline_line: str | None


def build_pricing_options(payload: dict[str, Any]) -> list[PricingOption]:
    """Packages and rates a client can choose from the vendor profile."""
    config = parse_vendor_discount_config(payload)
    service_lines = _services_feature_lines(payload)
    complete_pkgs = [p for p in _normalize_packages(payload) if _is_complete_package(p)]

    if complete_pkgs:
        options: list[PricingOption] = []
        for pkg in complete_pkgs:
            list_price = parse_single_money_gbp(pkg.price)
            unit = unit_price_from_list(list_price, config) if list_price is not None else None
            options.append(
                PricingOption(
                    id=pkg.id,
                    heading=pkg.title,
                    unit_price_gbp=unit,
                    description=_package_description(pkg),
                    feature_lines=service_lines,
                    timeline_line=pkg.duration.strip() or None,
                ),
            )
        return options

    hourly = parse_single_money_gbp(_coerce_str(payload, "hourlyRate"))
    daily = parse_single_money_gbp(_coerce_str(payload, "dailyRate"))
    options = []
    if hourly is not None:
        options.append(
            PricingOption(
                id="fixed-hourly",
                heading="Hourly rate",
                unit_price_gbp=unit_price_from_list(hourly, config),
                description=(
                    "Per-hour rate from this vendor's pricing step. "
                    "Scope, hours, and travel are confirmed when you enquire."
                ),
                feature_lines=service_lines,
                timeline_line=None,
            ),
        )
    if daily is not None:
        options.append(
            PricingOption(
                id="fixed-daily",
                heading="Daily rate",
                unit_price_gbp=unit_price_from_list(daily, config),
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


def _option_to_line_item(opt: PricingOption) -> dict[str, Any]:
    return {
        "id": opt.id,
        "heading": opt.heading,
        "unit_price_gbp": opt.unit_price_gbp,
        "description": opt.description,
        "feature_lines": list(opt.feature_lines),
        "timeline_line": opt.timeline_line,
    }


def resolve_line_items(
    payload: dict[str, Any],
    selected_option_ids: list[str],
) -> list[dict[str, Any]]:
    """
    Check selected package or rate ids against the vendor profile and return priced line items
    with the headline list discount applied. Bulk and off-peak discounts are added separately.
    """
    if not selected_option_ids:
        raise ValueError(vendor_messages.SELECT_PACKAGE_OR_RATE)

    seen: set[str] = set()
    unique_ids: list[str] = []
    for oid in selected_option_ids:
        s = str(oid).strip()
        if not s:
            continue
        if s in seen:
            raise ValueError(vendor_messages.DUPLICATE_PACKAGE_OR_RATE)
        seen.add(s)
        unique_ids.append(s)

    if not unique_ids:
        raise ValueError(vendor_messages.SELECT_PACKAGE_OR_RATE)

    options = build_pricing_options(payload)
    by_id = {o.id: o for o in options}

    line_items: list[dict[str, Any]] = []
    for oid in unique_ids:
        opt = by_id.get(oid)
        if opt is None:
            raise ValueError(vendor_messages.PACKAGES_NO_LONGER_AVAILABLE)
        line_items.append(_option_to_line_item(opt))

    has_priced_selection = any(
        li.get("unit_price_gbp") is not None for li in line_items
    )
    has_quote_only = len(options) == 1 and options[0].id == "quote"

    if not has_priced_selection and not has_quote_only:
        raise ValueError(vendor_messages.NO_PUBLISHED_PRICES)

    if has_quote_only and unique_ids != ["quote"]:
        raise ValueError(vendor_messages.QUOTE_ONLY_NO_PRICED_OPTIONS)

    return line_items


def _sum_positive_line_items(line_items: list[dict[str, Any]]) -> float:
    total = 0.0
    for li in line_items:
        if not isinstance(li, dict):
            continue
        lid = str(li.get("id") or "")
        if lid.startswith("auto-"):
            continue
        v = li.get("unit_price_gbp")
        if v is None:
            continue
        try:
            n = float(v)
        except (TypeError, ValueError):
            continue
        if n > 0:
            total += n
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
    out: list[dict[str, Any]] = []
    for li in line_items:
        if not isinstance(li, dict):
            continue
        lid = str(li.get("id") or "")
        if lid.startswith("auto-"):
            continue
        out.append(li)
    return out


def reconcile_automatic_discount_lines(
    line_items: list[dict[str, Any]],
    payload: dict[str, Any],
    event_date: date,
) -> list[dict[str, Any]]:
    """Priced line items plus freshly calculated bulk and off-peak discount rows."""
    base = strip_automatic_discount_lines(line_items)
    return base + compute_automatic_discount_lines(payload, base, event_date)


def min_listing_price_gbp(payload: dict[str, Any]) -> float | None:
    """Lowest sale price after the headline list discount only (not bulk or off-peak)."""
    options = build_pricing_options(payload)
    prices = [o.unit_price_gbp for o in options if o.unit_price_gbp is not None]
    if not prices:
        return None
    return min(prices)
