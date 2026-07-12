"""Validate vendor quote and booking line item prices."""

from __future__ import annotations

import math
from typing import Any

MAX_LINE_PRICE_GBP = 1_000_000.0
MIN_QUOTE_LINE_PRICE_GBP = 0.01
MAX_QUOTE_LINES = 25


def validate_quote_line_items(line_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Vendor quotes must have priced lines within bounds.
    Raises ValueError with a client-safe message on failure.
    """
    if not line_items:
        raise ValueError("Add at least one priced line item.")
    if len(line_items) > MAX_QUOTE_LINES:
        raise ValueError(f"A quote cannot have more than {MAX_QUOTE_LINES} line items.")

    out: list[dict[str, Any]] = []
    for raw in line_items:
        if not isinstance(raw, dict):
            raise ValueError("Invalid line item.")
        li = dict(raw)
        heading = str(li.get("heading") or "").strip()
        if not heading:
            raise ValueError("Each line item needs a heading.")

        v = li.get("unit_price_gbp")
        if v is None:
            raise ValueError("Each quote line needs a price.")
        try:
            price = float(v)
        except (TypeError, ValueError) as e:
            raise ValueError("Each quote line needs a valid price.") from e

        if not math.isfinite(price):
            raise ValueError("Each quote line needs a valid price.")
        if price < MIN_QUOTE_LINE_PRICE_GBP:
            raise ValueError(
                f"Each quote line must be at least GBP {MIN_QUOTE_LINE_PRICE_GBP:.2f}.",
            )
        if price > MAX_LINE_PRICE_GBP:
            raise ValueError("A quote line price is too high.")

        li["unit_price_gbp"] = round(price, 2)
        li["heading"] = heading[:200]
        out.append(li)

    return out
