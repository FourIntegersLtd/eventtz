"""Capture the marketplace search maths goldens from the baseline.

Covers query sanitising (``search_ai``), ranking and plan sections
(``search``), and the review-snippet / reviewer-display logic
(``bookings.reviews``).

Run with `make capture SCRIPT=capture/marketplace_goldens.py` (never directly).
Output goes to `marketplace/` under the golden directory:

- `query.json`: `_sanitize_parse_result`, `_token_only_parse` and `why_for_need`
  on odd model outputs and free-text queries.
- `rank.json`: `_rank_candidates` over a fixed pool of vendors, one case per
  filter combination (types, keywords, location, budget, every sort key,
  dates, limit/offset, `service_match_counts_as_exact`).
- `plan.json`: `_search_plan_sections` over the same vendor pool.
- `snippets.json`: `_reviewer_display_from_email` and
  `featured_snippets_for_vendor_ids` (the review quote a plan card shows).

The vendor review/public-metrics merges and the review-quote database lookup
are stubbed with fixed, in-memory data (module-attribute swaps, the same way
`vendor_profile_goldens.py` stands in for the database) so this script never
needs Supabase and its output is fully deterministic. `analytics.get_vendor_analytics`
is skipped: it reads the wall clock (`datetime.now`) with no fixed-input pure
function underneath it, so there is nothing here to freeze byte-exactly.

Add a case whenever the api/ implementation takes a branch no case covers,
then re-capture.
"""

from __future__ import annotations

import copy
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.features.bookings import reviews as reviews_module  # type: ignore[import-not-found]
from app.features.vendors import public_metrics as public_metrics_module  # type: ignore[import-not-found]
from app.features.vendors import search as search_module  # type: ignore[import-not-found]
from app.features.vendors import search_ai as search_ai_module  # type: ignore[import-not-found]

# --- a fixed pool of vendors and their trust signals, shared by rank.json and plan.json ---------------

VENDOR_POOL: list[dict[str, Any]] = [
    {
        "user_id": "vendor-01",
        "email": "ada@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-01-10T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "Ada's Cakes",
            "servicesOffered": ["baking", "catering"],
            "eventTypes": ["weddings", "birthdays"],
            "aiBioDraft": "Delicious jollof cakes for every celebration",
            "hourlyRate": "50",
            "blockedDates": ["2026-12-25"],
            "availableWeekdays": [5, 6],
        },
    },
    {
        "user_id": "vendor-02",
        "email": "jollof@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-02-01T10:00:00Z",
        "payload": {
            "baseCity": "Manchester",
            "businessName": "Jollof Kings",
            "servicesOffered": ["catering"],
            "eventTypes": ["birthdays"],
            "aiBioDraft": "Rice and small chops catering",
            "hourlyRate": "30",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-03",
        "email": "snap@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-03-01T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "Snap Studio",
            "servicesOffered": ["photography"],
            "eventTypes": ["weddings"],
            "aiBioDraft": "Wedding photography album shots",
            "hourlyRate": "200",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-04",
        "email": "spinz@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-01-15T10:00:00Z",
        "payload": {
            "baseCity": "Leeds",
            "businessName": "DJ Spinz",
            "servicesOffered": ["dj"],
            "eventTypes": ["weddings", "birthdays"],
            "aiBioDraft": "Dancefloor music all night",
            "hourlyRate": "80",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-05",
        "email": "glam@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-04-01T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "Glam MUA",
            "servicesOffered": ["makeup"],
            "eventTypes": ["weddings"],
            "aiBioDraft": "Bridal makeup glam looks",
            "hourlyRate": "60",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-06",
        "email": "balloon@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-05-01T10:00:00Z",
        "payload": {
            "baseCity": "Birmingham",
            "businessName": "Balloon Bliss",
            "servicesOffered": ["decor"],
            "eventTypes": ["birthdays", "showers"],
            "aiBioDraft": "Balloon backdrop styling",
            "hourlyRate": "120",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-07",
        "email": "hire@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-01-01T10:00:00Z",
        "payload": {
            "baseCity": "Manchester",
            "businessName": "Chair Hire Co",
            "servicesOffered": ["rentals"],
            "eventTypes": ["weddings"],
            "aiBioDraft": "Table chair marquee hire",
            "hourlyRate": "40",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-08",
        "email": "plan@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-06-01T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "Plan It",
            "servicesOffered": ["event_planning"],
            "eventTypes": ["weddings"],
            "aiBioDraft": "Wedding planner coordination timeline",
            "hourlyRate": "300",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-09",
        "email": "alaga@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-02-15T10:00:00Z",
        "payload": {
            "baseCity": "Leeds",
            "businessName": "MC Alaga",
            "servicesOffered": ["mc"],
            "eventTypes": ["weddings", "naming_ceremonies"],
            "aiBioDraft": "MC host emcee announce",
            "hourlyRate": "90",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-10",
        "email": "braids@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-07-01T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "Braids & Wigs",
            "servicesOffered": ["hair_styling"],
            "eventTypes": ["weddings"],
            "aiBioDraft": "Hair braids stylist bridal hair",
            "hourlyRate": "70",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-11",
        "email": "sugar@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-08-01T10:00:00Z",
        "payload": {
            "baseCity": "Manchester",
            "businessName": "Sugar Rush Cakes",
            "servicesOffered": ["baking"],
            "eventTypes": ["birthdays"],
            "aiBioDraft": "Birthday cake baker",
            "hourlyRate": "",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
    {
        "user_id": "vendor-12",
        "email": "allinone@example.com",
        "status": "active",
        "approval_status": "approved",
        "updated_at": "2025-09-01T10:00:00Z",
        "payload": {
            "baseCity": "London",
            "businessName": "All-in-One Events",
            "servicesOffered": ["catering", "dj"],
            "eventTypes": ["weddings", "birthdays"],
            "aiBioDraft": "Food and music for your event",
            "hourlyRate": "150",
            "blockedDates": [],
            "availableWeekdays": [],
        },
    },
]

SIGNALS_BY_VENDOR: dict[str, dict[str, Any]] = {
    "vendor-01": {
        "review_average": 4.5,
        "review_count": 10,
        "completed_bookings": 8,
        "avg_response_seconds": 600.0,
        "conversion_rate": 0.5,
    },
    "vendor-02": {
        "review_average": 4.9,
        "review_count": 3,
        "completed_bookings": 2,
        "avg_response_seconds": 1200.0,
        "conversion_rate": 0.2,
    },
    "vendor-03": {
        "review_average": None,
        "review_count": 0,
        "completed_bookings": 0,
        "avg_response_seconds": None,
        "conversion_rate": None,
    },
    "vendor-04": {
        "review_average": 3.8,
        "review_count": 20,
        "completed_bookings": 15,
        "avg_response_seconds": 300.0,
        "conversion_rate": 0.75,
    },
    "vendor-05": {
        "review_average": 4.2,
        "review_count": 5,
        "completed_bookings": 4,
        "avg_response_seconds": 900.0,
        "conversion_rate": 0.4,
    },
    "vendor-06": {
        "review_average": 5.0,
        "review_count": 1,
        "completed_bookings": 1,
        "avg_response_seconds": 100.0,
        "conversion_rate": 1.0,
    },
    "vendor-07": {
        "review_average": 4.0,
        "review_count": 8,
        "completed_bookings": 6,
        "avg_response_seconds": 500.0,
        "conversion_rate": 0.6,
    },
    "vendor-08": {
        "review_average": 3.5,
        "review_count": 12,
        "completed_bookings": 9,
        "avg_response_seconds": 1500.0,
        "conversion_rate": 0.3,
    },
    "vendor-09": {
        "review_average": 4.7,
        "review_count": 6,
        "completed_bookings": 5,
        "avg_response_seconds": 200.0,
        "conversion_rate": 0.83,
    },
    "vendor-10": {
        "review_average": 4.1,
        "review_count": 9,
        "completed_bookings": 7,
        "avg_response_seconds": 400.0,
        "conversion_rate": 0.35,
    },
    "vendor-11": {
        "review_average": None,
        "review_count": 0,
        "completed_bookings": 0,
        "avg_response_seconds": None,
        "conversion_rate": None,
    },
    "vendor-12": {
        "review_average": 4.6,
        "review_count": 15,
        "completed_bookings": 11,
        "avg_response_seconds": 350.0,
        "conversion_rate": 0.6,
    },
}


def stub_signal_merges() -> None:
    """Replace the two database-backed merges with fixed, in-memory `SIGNALS_BY_VENDOR` data."""

    def fake_merge_review_stats(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Add review_average/review_count from the fixed signals, like the real merge."""
        for row in rows:
            found = SIGNALS_BY_VENDOR.get(str(row.get("user_id") or ""), {})
            row["review_average"] = found.get("review_average")
            row["review_count"] = int(found.get("review_count") or 0)
        return rows

    def fake_merge_public_metrics(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Add completed_bookings/avg_response_seconds/conversion_rate from the fixed signals."""
        for row in rows:
            found = SIGNALS_BY_VENDOR.get(str(row.get("user_id") or ""), {})
            row["completed_bookings"] = int(found.get("completed_bookings") or 0)
            row["avg_response_seconds"] = found.get("avg_response_seconds")
            row["conversion_rate"] = found.get("conversion_rate")
        return rows

    reviews_module.merge_review_stats_into_vendor_rows = fake_merge_review_stats
    public_metrics_module.merge_public_metrics_into_vendor_rows = fake_merge_public_metrics


def stub_empty_snippets() -> None:
    """Make the plan search's inline review-quote lookup a deterministic no-op."""
    reviews_module.featured_snippets_for_vendor_ids = lambda *args, **kwargs: {}


# --- query sanitising (search_ai) --------------------------------------------------------------------

SANITIZE_CASES: list[dict[str, Any]] = [
    {"name": "empty dict", "reply": {}},
    {
        "name": "unknown types filtered",
        "reply": {"types": ["baking", "unknown", "juggling"], "mode": "simple"},
    },
    {
        "name": "related types exclude primary",
        "reply": {"types": ["baking"], "related_types": ["baking", "catering", "unknown"]},
    },
    {"name": "event types unknown filtered", "reply": {"event_types": ["weddings", "unknown_event"]}},
    {
        "name": "keywords dedupe and limit",
        "reply": {"keywords": ["Cake", "cake", " CAKE ", *[f"kw{number}" for number in range(20)]]},
    },
    {
        "name": "related keywords exclude keywords",
        "reply": {"keywords": ["cake"], "related_keywords": ["cake", "bake", "bake"]},
    },
    {"name": "location trims and clips", "reply": {"location": "  " + "x" * 200}},
    {
        "name": "related locations exclude location lowercase",
        "reply": {"location": "London", "related_locations": ["london", "Manchester", "manchester"]},
    },
    {"name": "intent summary clipped", "reply": {"intent_summary": "y" * 300}},
    {
        "name": "plan title clipped and mode plan",
        "reply": {
            "mode": "PLAN",
            "plan_title": "z" * 300,
            "needs": [{"service_key": "baking", "label": "Cake"}],
        },
    },
    {
        "name": "mode simple wipes needs and title",
        "reply": {"mode": "simple", "plan_title": "Title", "needs": [{"service_key": "baking"}]},
    },
    {
        "name": "needs unknown service dropped",
        "reply": {"mode": "plan", "needs": [{"service_key": "juggling", "label": "Juggler"}]},
    },
    {
        "name": "needs blank label falls back to title",
        "reply": {"mode": "plan", "needs": [{"service_key": "hair_styling", "label": "  "}]},
    },
    {
        "name": "needs blank id falls back to slug",
        "reply": {"mode": "plan", "needs": [{"service_key": "dj", "label": "Great DJ!", "id": ""}]},
    },
    {
        "name": "needs duplicate ids suffixed",
        "reply": {
            "mode": "plan",
            "needs": [
                {"service_key": "dj", "label": "DJ", "id": "dj"},
                {"service_key": "mc", "label": "DJ", "id": "dj"},
            ],
        },
    },
    {
        "name": "needs collapse duplicate service merges keywords",
        "reply": {
            "mode": "plan",
            "needs": [
                {"service_key": "catering", "keywords": ["rice"]},
                {"service_key": "catering", "keywords": ["jollof", "rice"]},
            ],
        },
    },
    {
        "name": "needs too many capped at six",
        "reply": {
            "mode": "plan",
            "needs": [
                {"service_key": key, "label": key}
                for key in [
                    "baking",
                    "catering",
                    "photography",
                    "makeup",
                    "rentals",
                    "event_planning",
                    "decor",
                ]
            ],
        },
    },
    {
        "name": "needs keywords empty default to service key",
        "reply": {"mode": "plan", "needs": [{"service_key": "mc", "keywords": []}]},
    },
    {
        "name": "needs rationale bare service dropped",
        "reply": {"mode": "plan", "needs": [{"service_key": "photography", "rationale": "  Photography.  "}]},
    },
    {
        "name": "needs rationale kept",
        "reply": {
            "mode": "plan",
            "needs": [{"service_key": "photography", "rationale": "Great for capturing memories."}],
        },
    },
    {
        "name": "plan mode derives types from non-optional needs",
        "reply": {
            "mode": "plan",
            "needs": [{"service_key": "baking"}, {"service_key": "catering", "optional": True}],
        },
    },
    {
        "name": "plan mode keeps explicit types",
        "reply": {"mode": "plan", "types": ["dj"], "needs": [{"service_key": "baking"}]},
    },
    {
        "name": "blank strings ignored",
        "reply": {"location": "   ", "intent_summary": "  ", "plan_title": "   "},
    },
    {
        "name": "non-list types ignored",
        "reply": {"types": "baking", "related_types": None, "event_types": 5},
    },
]

TOKEN_ONLY_CASES: list[dict[str, Any]] = [
    {"name": "empty", "query": ""},
    {"name": "blank", "query": "   "},
    {"name": "ordinary query", "query": "Cake and jollof rice"},
    {"name": "single char words dropped", "query": "a b cd"},
    {"name": "multiple spaces collapse", "query": "  MULTIPLE   Spaces   Here  "},
    {"name": "more than sixteen words capped", "query": " ".join(f"word{number}" for number in range(20))},
    {"name": "unicode", "query": "café déjà vu"},
    {"name": "punctuation kept", "query": "Caterer in Manchester!!"},
]

WHY_FOR_NEED_CASES: list[dict[str, Any]] = [
    {"name": "no rationale generic", "service_key": "baking", "rationale": None},
    {"name": "bare service name dropped", "service_key": "catering", "rationale": "Catering."},
    {
        "name": "real rationale kept",
        "service_key": "dj",
        "rationale": "  Great for keeping the party going.  ",
    },
    {"name": "blank rationale generic", "service_key": "mc", "rationale": ""},
    {"name": "bare underscore service dropped", "service_key": "hair_styling", "rationale": "Hair Styling"},
    {"name": "long rationale clipped", "service_key": "decor", "rationale": "x" * 200},
]


# --- ranking (search) ---------------------------------------------------------------------------------

RANK_DEFAULTS: dict[str, Any] = {
    "primary_types": [],
    "related_types": [],
    "keywords": [],
    "related_keywords": [],
    "location_filter": "",
    "related_locations": [],
    "parsed_event_types": [],
    "date_parts": [],
    "apply_date_availability": False,
    "budget_min": None,
    "budget_max": None,
    "sort_key": "relevance",
    "intent_summary": None,
    "limit": 50,
    "offset": 0,
    "service_match_counts_as_exact": False,
}

RANK_CASES: list[dict[str, Any]] = [
    {"name": "type filter catering", "params": {"primary_types": ["catering"]}},
    {"name": "type and keyword baking cake", "params": {"primary_types": ["baking"], "keywords": ["cake"]}},
    {"name": "location london", "params": {"location_filter": "London"}},
    {
        "name": "related location bristol matches london",
        "params": {
            "primary_types": ["photography"],
            "location_filter": "Bristol",
            "related_locations": ["london"],
        },
    },
    {"name": "budget narrow 50 100", "params": {"budget_min": 50, "budget_max": 100}},
    {"name": "budget excludes cheap vendors", "params": {"budget_min": 100}},
    {"name": "sort price ascending", "params": {"sort_key": "price_asc"}},
    {"name": "sort price descending", "params": {"sort_key": "price_desc"}},
    {"name": "sort proximity", "params": {"sort_key": "proximity"}},
    {"name": "sort rating", "params": {"sort_key": "rating"}},
    {
        "name": "blocked date excludes exact match",
        "params": {"date_parts": ["2026-12-25"], "apply_date_availability": True},
    },
    {
        "name": "non-working weekday excludes exact match",
        "params": {"date_parts": ["2026-11-02"], "apply_date_availability": True},
    },
    {
        "name": "flexible ignores the date filter",
        "params": {"date_parts": ["2026-12-25"], "apply_date_availability": False},
    },
    {"name": "limit and offset page through results", "params": {"limit": 3, "offset": 2}},
    {
        "name": "service match counts as exact",
        "params": {
            "primary_types": ["mc"],
            "keywords": ["nonexistentword"],
            "service_match_counts_as_exact": True,
        },
    },
    {
        "name": "service match does not count as exact",
        "params": {
            "primary_types": ["mc"],
            "keywords": ["nonexistentword"],
            "service_match_counts_as_exact": False,
        },
    },
    {
        "name": "fallback within the searched type",
        "params": {
            "primary_types": ["baking"],
            "keywords": ["zzzznomatch"],
            "location_filter": "Nowhereville",
        },
    },
    {
        "name": "fallback to every vendor",
        "params": {"keywords": ["zzzznomatch"], "location_filter": "Nowhereville"},
    },
    {
        "name": "event type hits raise score",
        "params": {"parsed_event_types": ["weddings"], "primary_types": ["photography", "event_planning"]},
    },
    {
        "name": "match notice carries the intent summary",
        "params": {
            "primary_types": ["hair_styling"],
            "location_filter": "Nowhereville",
            "keywords": ["zzz"],
            "intent_summary": "hair stylist",
        },
    },
]


# --- plan sections (search) ---------------------------------------------------------------------------

PLAN_CASES: list[dict[str, Any]] = [
    {
        "name": "birthday plan cake and food",
        "needs": [
            {
                "id": "cake",
                "label": "Birthday cake",
                "service_key": "baking",
                "keywords": ["cake"],
                "optional": False,
                "rationale": "Most birthday hosts book a cake.",
            },
            {
                "id": "food",
                "label": "Food for the party",
                "service_key": "catering",
                "keywords": ["food"],
                "optional": False,
                "rationale": None,
            },
        ],
        "plan_title": "Ideas for your birthday",
    },
    {
        "name": "a vendor is claimed by only the first matching need",
        "needs": [
            {
                "id": "food",
                "label": "Food for your guests",
                "service_key": "catering",
                "keywords": [],
                "optional": False,
                "rationale": None,
            },
            {
                "id": "music",
                "label": "DJ",
                "service_key": "dj",
                "keywords": [],
                "optional": False,
                "rationale": None,
            },
        ],
        "plan_title": None,
    },
    {
        "name": "a need with no matching vendors is left out",
        "needs": [
            {
                "id": "photos",
                "label": "Photos",
                "service_key": "photography",
                "keywords": [],
                "optional": False,
                "rationale": None,
            },
            {
                "id": "impossible",
                "label": "Fireworks",
                "service_key": "makeup",
                "keywords": ["nonexistentword"],
                "optional": False,
                "rationale": None,
            },
        ],
        "plan_title": "Wedding ideas",
    },
    {
        "name": "more than six needs are capped",
        "needs": [
            {
                "id": key,
                "label": key.title(),
                "service_key": key,
                "keywords": [],
                "optional": False,
                "rationale": None,
            }
            for key in [
                "baking",
                "catering",
                "photography",
                "makeup",
                "rentals",
                "event_planning",
                "decor",
            ]
        ],
        "plan_title": "Everything for your event",
    },
]


# --- reviewer display and review-quote choice (bookings.reviews) --------------------------------------

REVIEWER_DISPLAY_CASES: list[dict[str, Any]] = [
    {"name": "none", "email": None},
    {"name": "blank", "email": ""},
    {"name": "ordinary email", "email": "john.doe@example.com"},
    {"name": "single letter local part", "email": "a@example.com"},
    {"name": "already capitalised", "email": "Ada@example.com"},
    {"name": "symbols stripped down to blank", "email": "!!!@example.com"},
    {"name": "long local part clipped", "email": ("verylongusernamehere" * 2) + "@example.com"},
    {"name": "dots and dashes kept", "email": "user.name-123@sub.example.com"},
]

# vendor_user_id, rating, body, client_user_id - newest first, as the real query orders them.
SNIPPET_REVIEWS: list[dict[str, Any]] = [
    {
        "vendor_user_id": "vendor-01",
        "rating": 5,
        "body": "Best cake in London, would book again!",
        "client_user_id": "client-1",
    },
    {
        "vendor_user_id": "vendor-01",
        "rating": 4,
        "body": "Lovely cake, a little pricey.",
        "client_user_id": "client-2",
    },
    {
        "vendor_user_id": "vendor-02",
        "rating": 3,
        "body": "Great food and catering, jollof rice and chops were a hit at our buffet meal.",
        "client_user_id": "client-3",
    },
    {
        "vendor_user_id": "vendor-02",
        "rating": 4,
        "body": "Great vendor, highly recommend.",
        "client_user_id": "client-4",
    },
    {"vendor_user_id": "vendor-03", "rating": 1, "body": "", "client_user_id": "client-5"},
    {"vendor_user_id": "vendor-03", "rating": 0, "body": "Never showed up.", "client_user_id": "client-6"},
    {
        "vendor_user_id": "vendor-04",
        "rating": 5,
        "body": "d" * 200,
        "client_user_id": "client-7",
    },
    {
        "vendor_user_id": "vendor-05",
        "rating": 4,
        "body": "Glam makeup, no complaints at all.",
        "client_user_id": "client-8",
    },
    {
        "vendor_user_id": "vendor-05",
        "rating": 3,
        "body": "Bridal makeup and glam looked amazing, would recommend to anyone.",
        "client_user_id": "client-9",
    },
]
SNIPPET_CLIENT_EMAILS: dict[str, str] = {
    "client-1": "grace@example.com",
    "client-2": "tunde@example.com",
    "client-3": "amaka@example.com",
    "client-4": "chidi@example.com",
    "client-5": "sade@example.com",
    "client-6": "femi@example.com",
    "client-7": "bola@example.com",
    "client-8": "nkem@example.com",
    "client-9": "yemi@example.com",
}
SNIPPET_PREFER_TERMS: dict[str, list[str]] = {
    "vendor-01": ["cake", "baker", "baking", "cupcake", "dessert", "icing"],
    "vendor-02": ["food", "cater", "jollof", "chops", "meal", "rice", "buffet"],
    "vendor-05": ["makeup", "glam", "mua", "bridal"],
}


class _FakeQuery:
    """Stands in for a Supabase query builder: chains, then hands back fixed rows on `execute`."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        """Keep the fixed rows this query will return."""
        self._rows = rows

    def select(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept the column list."""
        return self

    def in_(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept the id filter (the fixture is already scoped to the ids asked for)."""
        return self

    def eq(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept an equality filter."""
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept an order clause (the fixture is already given in the right order)."""
        return self

    def limit(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept the row cap."""
        return self

    def is_(self, *_args: Any, **_kwargs: Any) -> _FakeQuery:
        """Accept the `hidden_at is null` filter."""
        return self

    def execute(self) -> Any:
        """Return the fixed rows as the real client's response object would."""

        class _Result:
            """A response object with just the `.data` attribute the real client returns."""

            data = self._rows

        return _Result()


class _FakeDb:
    """Stands in for the Supabase client, routing by table name to fixed rows."""

    def __init__(self, tables: dict[str, list[dict[str, Any]]]) -> None:
        """Keep the fixed rows for each table this test needs."""
        self._tables = tables

    def table(self, name: str) -> _FakeQuery:
        """A query over the named table's fixed rows."""
        return _FakeQuery(self._tables.get(name, []))


def featured_snippets(vendor_ids: list[str], prefer_terms: dict[str, list[str]]) -> dict[str, Any]:
    """Run the baseline's review-quote choice over `SNIPPET_REVIEWS` via a fake database."""
    users_rows = [{"id": client_id, "email": email} for client_id, email in SNIPPET_CLIENT_EMAILS.items()]
    reviews_module.get_db = lambda: _FakeDb(
        {"booking_reviews": copy.deepcopy(SNIPPET_REVIEWS), "users": users_rows},
    )
    return reviews_module.featured_snippets_for_vendor_ids(vendor_ids, prefer_terms_by_vendor=prefer_terms)


def result_to_json(result: Any) -> dict[str, Any]:
    """`MarketplaceSearchResult` as plain JSON: its `plan.needs` are pydantic models, not dataclasses."""
    data = asdict(result)
    if data.get("plan") is not None:
        data["plan"]["needs"] = [need.model_dump() for need in result.plan.needs]
    return data


def main(golden_root: Path) -> None:
    """Write every marketplace golden file."""
    output = golden_root / "marketplace"
    output.mkdir(parents=True, exist_ok=True)

    def write(name: str, data: Any) -> None:
        """Write one golden file as sorted, indented JSON."""
        (output / f"{name}.json").write_text(
            json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    write(
        "query",
        {
            "sanitize": [
                {
                    **case,
                    "result": search_ai_module.sanitize_marketplace_parse_result(case["reply"]).model_dump(),
                }
                for case in SANITIZE_CASES
            ],
            "token_only": [
                {**case, "result": search_ai_module.token_only_marketplace_parse(case["query"]).model_dump()}
                for case in TOKEN_ONLY_CASES
            ],
            "why_for_need": [
                {
                    **case,
                    "result": search_ai_module.why_for_need(
                        service_key=case["service_key"],
                        rationale=case["rationale"],
                    ),
                }
                for case in WHY_FOR_NEED_CASES
            ],
        },
    )

    write(
        "snippets",
        {
            "reviewer_display": [
                {**case, "display": reviews_module._reviewer_display_from_email(case["email"])}
                for case in REVIEWER_DISPLAY_CASES
            ],
            "choose_snippets": {
                "reviews": SNIPPET_REVIEWS,
                "client_emails": SNIPPET_CLIENT_EMAILS,
                "prefer_terms": SNIPPET_PREFER_TERMS,
                "cases": [
                    {
                        "name": "all vendors, with preferred terms",
                        "vendor_ids": sorted({row["vendor_user_id"] for row in SNIPPET_REVIEWS}),
                        "prefer_terms": SNIPPET_PREFER_TERMS,
                        "result": featured_snippets(
                            sorted({row["vendor_user_id"] for row in SNIPPET_REVIEWS}),
                            SNIPPET_PREFER_TERMS,
                        ),
                    },
                    {
                        "name": "no preferred terms falls back to rating and length",
                        "vendor_ids": sorted({row["vendor_user_id"] for row in SNIPPET_REVIEWS}),
                        "prefer_terms": {},
                        "result": featured_snippets(
                            sorted({row["vendor_user_id"] for row in SNIPPET_REVIEWS}),
                            {},
                        ),
                    },
                ],
            },
        },
    )

    # The rank and plan captures stub the database-backed merges (fixed signals, no
    # snippets), so this must run first while `featured_snippets_for_vendor_ids` is
    # still the real, database-backed function.
    stub_signal_merges()

    rank_results = []
    for case in RANK_CASES:
        params = {**RANK_DEFAULTS, **case["params"]}
        result = search_module._rank_candidates(copy.deepcopy(VENDOR_POOL), **params)
        rank_results.append(
            {"name": case["name"], "params": case["params"], "result": result_to_json(result)}
        )
    write("rank", {"vendor_pool": VENDOR_POOL, "signals": SIGNALS_BY_VENDOR, "cases": rank_results})

    stub_empty_snippets()

    plan_results = []
    for case in PLAN_CASES:
        result = search_module._search_plan_sections(
            copy.deepcopy(VENDOR_POOL),
            needs=[search_ai_module._sanitize_needs([need])[0] for need in case["needs"]],
            location_filter="",
            related_locations=[],
            parsed_event_types=[],
            date_parts=[],
            apply_date_availability=False,
            budget_min=None,
            budget_max=None,
            sort_key="relevance",
            intent_summary=None,
            plan_title=case["plan_title"],
        )
        plan_results.append(
            {
                "name": case["name"],
                "needs": case["needs"],
                "plan_title": case["plan_title"],
                "result": result_to_json(result),
            }
        )
    write("plan", {"vendor_pool": VENDOR_POOL, "signals": SIGNALS_BY_VENDOR, "cases": plan_results})


if __name__ == "__main__":
    main(Path(sys.argv[1]))
