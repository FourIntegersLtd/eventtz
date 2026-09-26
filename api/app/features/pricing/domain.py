"""Booking price maths: packages, vendor extras and discounts, and the Eventtz service fee. Pure.

A booking's price has three parts:

- the **vendor portion**: the sum of the package line items plus the vendor's
  adjustments (extras are positive, discounts negative);
- the **service fee**: a percentage of the vendor portion (5% by default, snapshotted
  on each booking), less any referral discount, never below zero;
- the **client total**: vendor portion plus service fee.

A line item with no price is "TBC": it adds nothing to the sums but marks the total
as provisional. Amounts are floats in pounds, rounded to pennies at each step, exactly
as the baseline does, so stored totals and receipts keep matching. (Moving to integer
pence is planned for the payments slice.)
"""

from __future__ import annotations

import math
import uuid
from dataclasses import asdict, dataclass
from typing import Any

# The platform's default service fee, as a percentage of the vendor portion.
BOOKING_SERVICE_FEE_PERCENT = 5.0
# Vendor adjustments beyond this many are dropped.
MAX_VENDOR_ADJUSTMENTS = 20
# Adjustments at or beyond ±£1bn are treated as typos and dropped.
ADJUSTMENT_LIMIT_GBP = 1e9
# Stored adjustment ids shorter than this are replaced with a fresh UUID.
MIN_ADJUSTMENT_ID_LENGTH = 8
MAX_TAG_LENGTH = 50
MAX_LABEL_LENGTH = 200
DEFAULT_TAG = "other"
DEFAULT_LABEL = "Additional cost"


@dataclass(frozen=True)
class VendorAdjustment:
    """One cleaned vendor extra (positive) or discount (negative) on a booking."""

    id: str
    tag: str
    label: str
    amount_gbp: float


@dataclass(frozen=True)
class PricingBreakdown:
    """Every figure and label the booking screens, receipts and emails show for a price.

    `to_dict()` gives the baseline's JSON shape, which the web app reads directly.
    """

    line_items_subtotal_gbp: float
    vendor_adjustments: list[VendorAdjustment]
    adjustments_total_gbp: float
    vendor_portion_gbp: float
    service_fee_percent: float
    service_fee_before_discount_gbp: float
    referral_fee_discount_gbp: float
    referral_tier_min_spend_gbp: float | None
    referral_fee_applied: bool
    service_fee_gbp: float
    client_total_gbp: float
    has_pricing_tbc: bool
    vendor_portion_label: str
    service_fee_before_discount_label: str
    referral_fee_discount_label: str | None
    service_fee_label: str
    client_total_label: str
    line_items_subtotal_label: str

    def to_dict(self) -> dict[str, Any]:
        """The breakdown as plain JSON-ready values (adjustments become dicts too)."""
        return asdict(self)


def format_gbp(amount: float) -> str:
    """A money label such as `GBP 12.50`; whole pounds drop the pennies (`GBP 12`); NaN is `GBP 0.00`."""
    if math.isnan(amount):
        return "GBP 0.00"
    text = f"{amount:.2f}"
    if text.endswith(".00"):
        text = str(int(round(amount)))
    return f"GBP {text}"


def sum_line_items_gbp(line_items: object) -> tuple[float, bool]:
    """The sum of the priced line items, and whether any line has no usable price (TBC)."""
    if not isinstance(line_items, list):
        return 0.0, False
    total = 0.0
    has_tbc = False
    for line_item in line_items:
        if not isinstance(line_item, dict):
            continue
        price = line_item.get("unit_price_gbp")
        if price is None:
            has_tbc = True
            continue
        try:
            total += float(price)
        except (TypeError, ValueError):
            has_tbc = True
    return total, has_tbc


def _clean_text(value: object, *, default: str, max_length: int) -> str:
    """Trimmed and truncated text, or `default` when blank."""
    return str(value or default).strip()[:max_length] or default


def normalise_vendor_adjustments(raw_adjustments: object) -> list[VendorAdjustment]:
    """Clean stored adjustments: drop zero, unparseable and absurd amounts; fill blank text; cap the count."""
    if not isinstance(raw_adjustments, list):
        return []
    cleaned: list[VendorAdjustment] = []
    for raw_adjustment in raw_adjustments:
        if not isinstance(raw_adjustment, dict):
            continue
        try:
            amount = float(raw_adjustment.get("amount_gbp"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if amount == 0 or amount <= -ADJUSTMENT_LIMIT_GBP or amount >= ADJUSTMENT_LIMIT_GBP:
            continue
        adjustment_id = str(raw_adjustment.get("id") or "").strip()
        cleaned.append(
            VendorAdjustment(
                id=adjustment_id if len(adjustment_id) >= MIN_ADJUSTMENT_ID_LENGTH else str(uuid.uuid4()),
                tag=_clean_text(raw_adjustment.get("tag"), default=DEFAULT_TAG, max_length=MAX_TAG_LENGTH),
                label=_clean_text(
                    raw_adjustment.get("label"), default=DEFAULT_LABEL, max_length=MAX_LABEL_LENGTH
                ),
                amount_gbp=round(amount, 2),
            )
        )
    return cleaned[:MAX_VENDOR_ADJUSTMENTS]


def service_fee_percent_or_default(stored_percent: object) -> float:
    """A stored fee percent when it is a number from 0 to 100, else the platform default."""
    if stored_percent is None:
        return BOOKING_SERVICE_FEE_PERCENT
    try:
        percent = float(stored_percent)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return BOOKING_SERVICE_FEE_PERCENT
    return percent if 0.0 <= percent <= 100.0 else BOOKING_SERVICE_FEE_PERCENT


def resolve_service_fee_percent(booking_row: object) -> float:
    """The fee percent snapshotted on a booking row (its `service_fee_percent`), else the platform default."""
    if not isinstance(booking_row, dict):
        return BOOKING_SERVICE_FEE_PERCENT
    return service_fee_percent_or_default(booking_row.get("service_fee_percent"))


def vendor_portion_gbp(
    line_items: object, vendor_adjustments: object, *, include_adjustments: bool = True
) -> float:
    """What the vendor charges: line items plus (optionally) cleaned adjustments, rounded to pennies."""
    line_items_total, _has_tbc = sum_line_items_gbp(line_items)
    adjustments_total = (
        sum(adjustment.amount_gbp for adjustment in normalise_vendor_adjustments(vendor_adjustments))
        if include_adjustments
        else 0.0
    )
    return round(line_items_total + adjustments_total, 2)


def build_pricing_breakdown(
    *,
    line_items: object,
    vendor_adjustments: object,
    service_fee_percent: float | None = None,
    referral_fee_discount_gbp: float = 0.0,
    referral_tier_min_spend_gbp: float | None = None,
) -> PricingBreakdown:
    """Price a booking. The referral discount comes off the service fee only, and never below zero."""
    percent = BOOKING_SERVICE_FEE_PERCENT if service_fee_percent is None else float(service_fee_percent)
    percent = max(0.0, min(100.0, percent))

    line_items_total, has_tbc = sum_line_items_gbp(line_items)
    adjustments = normalise_vendor_adjustments(vendor_adjustments)
    # Starts from the int 0 like the baseline, so an empty list reports `0` rather than `0.0`.
    adjustments_total = sum(adjustment.amount_gbp for adjustment in adjustments)

    portion = round(line_items_total + adjustments_total, 2)
    fee_base = round(max(0.0, portion), 2)
    fee_before_discount = round(fee_base * (percent / 100.0), 2)
    requested_discount = max(0.0, float(referral_fee_discount_gbp or 0))
    discount_applied = round(min(requested_discount, fee_before_discount), 2)
    fee = round(max(0.0, fee_before_discount - discount_applied), 2)
    client_total = round(portion + fee, 2)

    return PricingBreakdown(
        line_items_subtotal_gbp=round(line_items_total, 2),
        vendor_adjustments=adjustments,
        adjustments_total_gbp=round(adjustments_total, 2),
        vendor_portion_gbp=portion,
        service_fee_percent=percent,
        service_fee_before_discount_gbp=fee_before_discount,
        referral_fee_discount_gbp=discount_applied,
        referral_tier_min_spend_gbp=referral_tier_min_spend_gbp,
        referral_fee_applied=discount_applied > 0,
        service_fee_gbp=fee,
        client_total_gbp=client_total,
        has_pricing_tbc=has_tbc,
        vendor_portion_label=format_gbp(portion),
        service_fee_before_discount_label=format_gbp(fee_before_discount),
        referral_fee_discount_label=format_gbp(-discount_applied) if discount_applied > 0 else None,
        service_fee_label=format_gbp(fee),
        client_total_label=format_gbp(client_total),
        line_items_subtotal_label=format_gbp(line_items_total),
    )


def persisted_total_label(breakdown: PricingBreakdown) -> str:
    """The stored `booking_requests.total_label`: the client total, plus `+ TBC` for unpriced lines."""
    client_label = breakdown.client_total_label.strip()
    if breakdown.has_pricing_tbc:
        if breakdown.line_items_subtotal_gbp == 0 and breakdown.adjustments_total_gbp == 0:
            return "TBC"
        return f"{client_label} + TBC" if client_label else "TBC"
    return client_label or "GBP 0"
