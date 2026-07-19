"""Defaults and budget template percentages for the AI Event Planner."""

from __future__ import annotations

DEFAULT_GUEST_COUNT = 80
MAX_PROMPT_LENGTH = 2000

# Soft guest clamp for catering scale estimates.
MIN_GUEST_ESTIMATE = 10
MAX_GUEST_ESTIMATE = 500

# Per-event-type budget split across service keys (normalized among present needs).
# Values are relative weights, not hard percentages of the user budget until normalized.
BUDGET_SPLIT_BY_EVENT: dict[str, dict[str, float]] = {
    "birthdays": {
        "catering": 0.35,
        "baking": 0.10,
        "photography": 0.20,
        "rentals": 0.25,
        "makeup": 0.10,
    },
    "weddings": {
        "catering": 0.30,
        "baking": 0.10,
        "photography": 0.20,
        "makeup": 0.15,
        "rentals": 0.25,
    },
    "showers": {
        "catering": 0.40,
        "baking": 0.15,
        "photography": 0.20,
        "rentals": 0.25,
    },
    "naming_ceremonies": {
        "catering": 0.40,
        "baking": 0.15,
        "photography": 0.20,
        "rentals": 0.25,
    },
    "corporate": {
        "catering": 0.50,
        "photography": 0.25,
        "rentals": 0.25,
    },
    "funeral": {
        "catering": 0.50,
        "photography": 0.25,
        "rentals": 0.25,
    },
}

# Fallback template estimates (GBP) when vendor has no list price.
# Catering is per-guest; others are flat starting points.
TEMPLATE_COST_FLAT_GBP: dict[str, float] = {
    "baking": 120.0,
    "photography": 450.0,
    "makeup": 180.0,
    "rentals": 350.0,
}
TEMPLATE_CATERING_PER_GUEST_GBP = 18.0

DEDUPE_WINDOW_SECONDS = 20
