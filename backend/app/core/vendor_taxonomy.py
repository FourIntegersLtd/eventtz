"""Allowed vendor service and event-type keys (aligned with frontend onboarding constants)."""

from __future__ import annotations

VENDOR_SERVICE_KEYS: frozenset[str] = frozenset(
    {"baking", "catering", "photography", "makeup", "rentals"},
)

VENDOR_EVENT_TYPE_KEYS: frozenset[str] = frozenset(
    {"weddings", "birthdays", "showers", "naming_ceremonies"},
)


def filter_service_keys(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for item in raw:
        key = str(item).strip().lower()
        if key in VENDOR_SERVICE_KEYS and key not in out:
            out.append(key)
    return out


def filter_event_type_keys(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for item in raw:
        key = str(item).strip().lower()
        if key in VENDOR_EVENT_TYPE_KEYS and key not in out:
            out.append(key)
    return out
