"""When the client must accept a new price on a pending booking."""

from __future__ import annotations

from typing import Any


def normalize_vendor_adjustments_list(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    return [a for a in raw if isinstance(a, dict)]


def client_price_confirmation_required(row: dict[str, Any]) -> bool:
    """True when a client-initiated pending booking has vendor price changes waiting for the client."""
    if str(row.get("status", "")) != "pending":
        return False
    initiator = row.get("initiator")
    if initiator == "vendor":
        return False
    return len(normalize_vendor_adjustments_list(row.get("vendor_adjustments"))) > 0
