"""The vendor catalogue other slices may use: service and event keys, markets, list prices.

Pure. The rules live in `domain_catalogue` and `domain_price_list`; this module is
only their public face, because a slice reaches another slice through its
`service*` modules (`tests/guards/test_slices_call_services_only.py`).
"""

from __future__ import annotations

from app.features.vendors.domain_catalogue import (
    VENDOR_EVENT_TYPE_KEYS,
    VENDOR_SERVICE_KEYS,
    MarketConfig,
    filter_event_type_keys,
    filter_service_keys,
    get_market,
    normalize_country_code,
)
from app.features.vendors.domain_price_list import (
    compute_automatic_discount_lines,
    min_listing_price_gbp,
    parse_money_gbp,
    resolve_line_items,
)

__all__ = [
    "VENDOR_EVENT_TYPE_KEYS",
    "VENDOR_SERVICE_KEYS",
    "MarketConfig",
    "filter_event_type_keys",
    "filter_service_keys",
    "get_market",
    "compute_automatic_discount_lines",
    "min_listing_price_gbp",
    "parse_money_gbp",
    "resolve_line_items",
    "normalize_country_code",
]
