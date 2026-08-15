"""Validate prices on vendor quote packages."""

from __future__ import annotations

import math
from typing import Any

from app.features.bookings import messages as booking_messages

MAX_LINE_PRICE_GBP = 1_000_000.0
MIN_QUOTE_LINE_PRICE_GBP = 0.01
MAX_QUOTE_LINES = 25


def validate_quote_line_items(line_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Vendor quotes must have priced packages within set limits.
    Raises ValueError with a client-safe message on failure.
    """
    if not line_items:
        raise ValueError(booking_messages.ADD_PRICED_LINE_ITEM)
    if len(line_items) > MAX_QUOTE_LINES:
        raise ValueError(booking_messages.quote_max_lines_detail(MAX_QUOTE_LINES))

    out: list[dict[str, Any]] = []
    for raw in line_items:
        if not isinstance(raw, dict):
            raise ValueError(booking_messages.INVALID_LINE_ITEM)
        li = dict(raw)
        heading = str(li.get("heading") or "").strip()
        if not heading:
            raise ValueError(booking_messages.LINE_ITEM_NEEDS_HEADING)

        v = li.get("unit_price_gbp")
        if v is None:
            raise ValueError(booking_messages.QUOTE_LINE_NEEDS_PRICE)
        try:
            price = float(v)
        except (TypeError, ValueError) as e:
            raise ValueError(booking_messages.QUOTE_LINE_VALID_PRICE) from e

        if not math.isfinite(price):
            raise ValueError(booking_messages.QUOTE_LINE_VALID_PRICE)
        if price < MIN_QUOTE_LINE_PRICE_GBP:
            raise ValueError(
                booking_messages.quote_line_min_price_detail(MIN_QUOTE_LINE_PRICE_GBP),
            )
        if price > MAX_LINE_PRICE_GBP:
            raise ValueError(booking_messages.QUOTE_LINE_PRICE_TOO_HIGH)

        li["unit_price_gbp"] = round(price, 2)
        li["heading"] = heading[:200]
        out.append(li)

    return out
