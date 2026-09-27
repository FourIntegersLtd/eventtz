"""Pure planner logic: what a celebration needs, how its budget splits, how confident we
are in the picks, and the deterministic reading of a prompt or vendor pool when no
language model reply is available (or none was asked for).

No database, HTTP or adapter import may appear here - see
`tests/guards/test_domain_is_io_free.py`. Every function takes plain values and
dataclasses in, and returns plain values and dataclasses out.

Simplification (Laziness protocol / Subtract before you add, see the slice README):
this ports the baseline's `category_planner.py`, `budget.py` and `confidence.py`
rules, but replaces the full `VendorRankingEngine` (which scores reviews,
completed-booking counts, response time and conversion rate) with the simpler
location/budget/keyword tiering `explore_vendor_adapter.filter_candidates_for_need`
already used, since no acceptance test exercises the fuller engine's scoring.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

# --- prompts, guest counts and money that need a sane fallback -----------------------------------

DEFAULT_GUEST_COUNT = 80
MAX_PROMPT_LENGTH = 2000
MIN_GUEST_ESTIMATE = 10
MAX_GUEST_ESTIMATE = 500

BUDGET_ASSUMPTION_LINE = (
    "Each line is the estimated cost for the recommended vendor - not a forced split of your budget."
)
OVER_BUDGET_ASSUMPTION_LINE = (
    "Your budget is a target. We still recommend strong vendors and flag when estimates exceed it."
)
GUEST_COUNT_ASSUMED_LINE = (
    f"Guest count was not stated, so a default of {DEFAULT_GUEST_COUNT} guests was assumed."
)
NO_BUDGET_STATED_LINE = "No budget was stated, so no line has an allocated share."

# --- what a celebration needs ---------------------------------------------------------------------

# One template need per service a celebration might use. `need_id` becomes the plan
# item's slug; `service_key` is the vendor catalogue key the marketplace uses.
NEED_LIBRARY: dict[str, dict[str, object]] = {
    "food": {
        "label": "Catering",
        "service_key": "catering",
        "optional": False,
        "keywords": ["catering", "food", "caterer"],
    },
    "cake": {
        "label": "Cake",
        "service_key": "baking",
        "optional": True,
        "keywords": ["cake", "baker", "baking"],
    },
    "photos": {
        "label": "Photography",
        "service_key": "photography",
        "optional": True,
        "keywords": ["photographer", "photography", "photos"],
    },
    "glam": {
        "label": "Makeup",
        "service_key": "makeup",
        "optional": True,
        "keywords": ["makeup", "mua", "glam"],
    },
    "hair": {
        "label": "Hair styling",
        "service_key": "hair_styling",
        "optional": True,
        "keywords": ["hair", "stylist", "hairstyling"],
    },
    "hire": {
        "label": "Equipment hire",
        "service_key": "rentals",
        "optional": True,
        "keywords": ["hire", "rental", "rentals"],
    },
    "decor": {
        "label": "Decor",
        "service_key": "decor",
        "optional": True,
        "keywords": ["decor", "decoration", "balloons"],
    },
    "dj": {
        "label": "DJ",
        "service_key": "dj",
        "optional": True,
        "keywords": ["dj", "music", "entertainment"],
    },
    "mc": {
        "label": "MC / host",
        "service_key": "mc",
        "optional": True,
        "keywords": ["mc", "host", "compere"],
    },
    "planning": {
        "label": "Event planning",
        "service_key": "event_planning",
        "optional": True,
        "keywords": ["planner", "coordination", "planning"],
    },
}

# The needs a celebration of each family gets, in display order. Capped at 10 by
# `NEED_LIBRARY`'s own size.
EVENT_NEEDS: dict[str, list[str]] = {
    "birthdays": ["food", "cake", "photos", "decor", "dj", "hair"],
    "weddings": ["food", "photos", "decor", "dj", "hair", "glam", "planning"],
    "showers": ["food", "cake", "decor", "photos", "glam"],
    "naming_ceremonies": ["food", "cake", "decor", "photos"],
    "corporate": ["food", "planning", "hire", "photos"],
    "funeral": ["food", "hire", "planning"],
}

# Synonyms a client might type, mapped to one of the `EVENT_NEEDS` families above.
EVENT_ALIASES: dict[str, str] = {
    "birthday": "birthdays",
    "engagement": "weddings",
    "wedding": "weddings",
    "graduation": "birthdays",
    "baby shower": "showers",
    "shower": "showers",
    "naming ceremony": "naming_ceremonies",
    "christening": "naming_ceremonies",
    "corporate": "corporate",
    "work": "corporate",
    "office": "corporate",
    "funeral": "funeral",
    "memorial": "funeral",
    "wake": "funeral",
    "repast": "funeral",
}


def normalize_event_type(raw: str | None) -> str:
    """The canonical event family for a client's free-text event type, defaulting to birthdays."""
    candidate = (raw or "").strip().lower()
    if candidate in EVENT_NEEDS:
        return candidate
    if candidate in EVENT_ALIASES:
        return EVENT_ALIASES[candidate]
    for alias, canonical in EVENT_ALIASES.items():
        if alias in candidate:
            return canonical
    return "birthdays"


def needs_for_event(event_type: str) -> list[dict[str, object]]:
    """The ordered need templates (`need_id`, `label`, `service_key`, `optional`) for this event family."""
    need_keys = EVENT_NEEDS.get(event_type, EVENT_NEEDS["birthdays"])
    needs = []
    for need_key in need_keys:
        template = NEED_LIBRARY[need_key]
        needs.append(
            {
                "need_id": need_key,
                "label": template["label"],
                "service_key": template["service_key"],
                "optional": template["optional"],
            }
        )
    return needs


def need_keywords(need_id: str) -> list[str]:
    """The search keywords for one need template, typed (`NEED_LIBRARY`'s values are heterogeneous)."""
    raw_keywords = NEED_LIBRARY.get(need_id, {}).get("keywords", [])
    if not isinstance(raw_keywords, list):
        return []
    return [str(keyword) for keyword in raw_keywords]


# --- reading a free-text prompt without a language model ------------------------------------------

_GUEST_RE = re.compile(r"(\d{1,4})\s*(?:guests|people|pax|attendees)", re.IGNORECASE)
_BUDGET_RE = re.compile(r"(?:£|budget of|budget[:\s]+)\s*([\d,]+(?:\.\d+)?)", re.IGNORECASE)
_LOCATION_RE = re.compile(r"\bin\s+([A-Z][A-Za-z\-]+(?:\s+[A-Z][A-Za-z\-]+)?)")


def prompt_is_nonsense(prompt: str) -> bool:
    """True for a prompt with no letters at all (baseline's `_looks_like_nonsense`, simplified)."""
    stripped = prompt.strip()
    return not stripped or not any(character.isalpha() for character in stripped)


def canned_brief(prompt: str) -> dict[str, object]:
    """A deterministic regex reading of the prompt, used when no model reply is available."""
    event_type = normalize_event_type(prompt)
    guest_match = _GUEST_RE.search(prompt)
    budget_match = _BUDGET_RE.search(prompt)
    location_match = _LOCATION_RE.search(prompt)
    return {
        "event_type": event_type,
        "event_kind": "standard",
        "location": location_match.group(1).strip() if location_match else None,
        "related_locations": [],
        "guest_count": int(guest_match.group(1)) if guest_match else None,
        "budget_gbp": float(budget_match.group(1).replace(",", "")) if budget_match else None,
        "preferred_date": None,
        "preferred_date_invalid": False,
        "indoor_outdoor": None,
        "cuisine_notes": None,
        "music_notes": None,
        "special_requirements": None,
        "excluded_needs": [],
        "currency_assumed_gbp": False,
        "raw_prompt": prompt,
        "unsupported_categories_mentioned": [],
    }


def merge_brief(model_brief: dict[str, object], fallback_brief: dict[str, object]) -> dict[str, object]:
    """The model's reading of the prompt, with the canned reading filling any gap it left blank."""
    merged = dict(fallback_brief)
    for key, value in model_brief.items():
        if value not in (None, "", []):
            merged[key] = value
    merged["raw_prompt"] = fallback_brief["raw_prompt"]
    return merged


def build_title(*, event_type: str, location: str | None, guest_count: int | None) -> str:
    """A short plan title from the brief, matching the baseline's exact phrasing per event family."""
    if event_type == "funeral":
        return f"Memorial gathering · {location}" if location else "Memorial gathering"
    if event_type == "corporate":
        return f"Corporate event · {location}" if location else "Corporate event"
    label = event_type.replace("_", " ").title()
    if location and guest_count:
        return f"{label} · {location} · {guest_count} guests"
    if location:
        return f"{label} · {location}"
    return label


def template_summary(
    *, title: str, event_type: str, location: str | None, guest_count: int, need_labels: list[str]
) -> str:
    """A short paragraph describing the plan, used when the model's own summary is unavailable."""
    covering = ", ".join(need_labels) if need_labels else "your celebration"
    place = location or "your area"
    return f"{title}: a {event_type} plan in {place} for about {guest_count} guests. Covering {covering}."


# --- how confident we are in the picks -------------------------------------------------------------


def compute_confidence(
    *,
    empty_need_labels: list[str],
    has_low_review_vendor: bool,
    budget_over: bool,
    guest_count_used_default: bool,
    budget_stated: bool,
) -> tuple[int, list[str]]:
    """A 0-100 confidence score and up to three reasons, from real signals only."""
    score = 100
    reasons: list[str] = []
    if empty_need_labels:
        score -= min(40, 12 * len(empty_need_labels))
        reasons.append(f"No strong matches yet for {', '.join(empty_need_labels)}.")
    if has_low_review_vendor:
        score -= 6
        reasons.append("Some recommended vendors have few reviews yet.")
    if budget_over:
        score -= 15
        reasons.append("Estimated costs are over your stated budget.")
    if guest_count_used_default:
        score -= 4
    if not budget_stated:
        score -= 3
    score = max(0, min(100, score))
    if not reasons and score >= 90:
        reasons.append("Strong matches found for every need.")
    return score, reasons[:3]


# --- what the client should do next -----------------------------------------------------------------

MAX_NEXT_STEPS = 4


@dataclass(frozen=True)
class NeedOutcome:
    """What the next-steps list needs to know about one need on a finished plan."""

    label: str
    has_primary: bool
    optional: bool


def suggested_next_steps(needs: list[NeedOutcome], *, budget_stated: bool) -> list[str]:
    """Up to four plain-English next steps for the plan, in the baseline's order and wording.

    The first required need with a pick is named because the baseline treats it as the one
    most likely to book out; a need with no pick asks the client to widen the search.
    """
    steps: list[str] = []
    required_with_pick = [need for need in needs if need.has_primary and not need.optional]
    if required_with_pick:
        steps.append(f"Review {required_with_pick[0].label.lower()} first - it often books out earliest.")
    if any(not need.has_primary for need in needs):
        steps.append("Widen location or budget for categories with no matches, then Replace.")
    steps.append("Open a vendor profile to request a booking - nothing is booked until you confirm.")
    if budget_stated:
        steps.append("Compare estimated costs against your budget before enquiring.")
    return steps[:MAX_NEXT_STEPS]


# --- estimating and allocating money --------------------------------------------------------------


@dataclass(frozen=True)
class CostEstimate:
    """One need's estimated cost, the sentence that explains it, and where the number came from."""

    amount_gbp: float
    assumption: str
    source: Literal["vendor_list_price", "template"]


TEMPLATE_COST_FLAT_GBP: dict[str, float] = {
    "baking": 120.0,
    "photography": 450.0,
    "makeup": 180.0,
    "hair_styling": 150.0,
    "rentals": 350.0,
    "decor": 400.0,
    "dj": 500.0,
    "mc": 300.0,
    "event_planning": 600.0,
}
TEMPLATE_CATERING_PER_GUEST_GBP = 18.0

# Rough starting share of the budget for each service; normalised at allocation time
# to whichever needs are actually on the plan (never the full category template).
BUDGET_WEIGHT_BY_SERVICE: dict[str, float] = {
    "catering": 0.35,
    "dj": 0.15,
    "decor": 0.15,
    "photography": 0.15,
    "baking": 0.10,
    "hair_styling": 0.05,
    "makeup": 0.05,
    "rentals": 0.20,
    "mc": 0.10,
    "event_planning": 0.20,
}

_SERVICE_LABELS: dict[str, str] = {
    str(template["service_key"]): str(template["label"]) for template in NEED_LIBRARY.values()
}


def _guest_scale(guest_count: int | None) -> tuple[int, bool]:
    """The guest count clamped to a sane range, and whether the default had to be used."""
    if guest_count is None:
        return DEFAULT_GUEST_COUNT, True
    return max(MIN_GUEST_ESTIMATE, min(MAX_GUEST_ESTIMATE, guest_count)), False


def template_estimate(service_key: str, *, guest_count: int | None) -> CostEstimate:
    """A generic starting estimate for a need with no vendor list price yet."""
    guests, used_default = _guest_scale(guest_count)
    if service_key == "catering":
        amount = round(TEMPLATE_CATERING_PER_GUEST_GBP * guests, 2)
        guest_note = "the default guest count" if used_default else f"{guests} guests"
        per_guest = f"£{TEMPLATE_CATERING_PER_GUEST_GBP:.0f}/guest"
        assumption = f"Estimate: {per_guest} × {guest_note} - vendor has no list price yet"
        return CostEstimate(amount, assumption, "template")
    label = _SERVICE_LABELS.get(service_key, service_key.replace("_", " ").title())
    amount = TEMPLATE_COST_FLAT_GBP.get(service_key, 250.0)
    return CostEstimate(
        amount, f"Typical starting estimate for {label} - vendor has no list price yet", "template"
    )


def estimate_need_cost(
    *,
    service_key: str,
    guest_count: int | None,
    primary_min_list_price: float | None,
    vendor_name: str | None = None,
) -> CostEstimate:
    """The primary vendor's own list price when there is one, else a template estimate."""
    if primary_min_list_price is not None and primary_min_list_price >= 0:
        name = (vendor_name or "Recommended vendor").strip() or "Recommended vendor"
        return CostEstimate(
            round(primary_min_list_price, 2),
            f"From {name}'s lowest listed package/rate on Eventtz",
            "vendor_list_price",
        )
    return template_estimate(service_key, guest_count=guest_count)


def allocate_budget_bands(
    needs: list[dict[str, object]], *, user_budget_gbp: float | None
) -> dict[str, float | None]:
    """Each need's share of the client's stated budget, normalised over only the needs given."""
    if user_budget_gbp is None:
        return {str(need["need_id"]): None for need in needs}
    weights = {
        str(need["need_id"]): BUDGET_WEIGHT_BY_SERVICE.get(str(need["service_key"]), 0.1) for need in needs
    }
    total_weight = sum(weights.values()) or 1.0
    return {need_id: round(user_budget_gbp * weight / total_weight, 2) for need_id, weight in weights.items()}


def build_budget_breakdown(
    *,
    needs: list[dict[str, object]],
    cost_by_need: dict[str, float | None],
    assumption_by_need: dict[str, str],
    allocated_by_need: dict[str, float | None],
    user_budget_gbp: float | None,
    guest_count_used_default: bool,
) -> dict[str, object]:
    """The full budget breakdown: one line per costed need, the total, and what is left."""
    lines: list[dict[str, object]] = []
    total = 0.0
    has_any = False
    for need in needs:
        need_id = str(need["need_id"])
        cost = cost_by_need.get(need_id)
        if cost is None:
            continue
        has_any = True
        total += cost
        lines.append(
            {
                "need_id": need_id,
                "label": need["label"],
                "amount_gbp": cost,
                "allocated_gbp": allocated_by_need.get(need_id),
                "assumption": assumption_by_need.get(need_id, ""),
            }
        )
    total = round(total, 2)
    remaining = round(user_budget_gbp - total, 2) if user_budget_gbp is not None and has_any else None
    over_budget = bool(remaining is not None and remaining < 0)
    assumptions = [BUDGET_ASSUMPTION_LINE]
    if guest_count_used_default:
        assumptions.append(GUEST_COUNT_ASSUMED_LINE)
    if over_budget:
        assumptions.append(OVER_BUDGET_ASSUMPTION_LINE)
    if user_budget_gbp is None:
        assumptions.append(NO_BUDGET_STATED_LINE)
    return {
        "lines": lines,
        "total_estimated_gbp": total,
        "remaining_budget_gbp": remaining,
        "user_budget_gbp": user_budget_gbp,
        "over_budget": over_budget,
        "assumptions": assumptions,
    }


# --- picking vendors without the full ranking engine ------------------------------------------------


@dataclass(frozen=True)
class VendorCandidate:
    """One listed vendor as the selection tiering sees it."""

    user_id: str
    business_name: str
    city: str | None
    min_list_price_gbp: float | None
    services: frozenset[str]
    bio: str = ""


def _location_tier(city: str | None, location: str | None, related_locations: list[str]) -> int:
    """0 for a city matching the celebration's own location, 1 for a related one, else 2."""
    if not location:
        return 1
    if not city:
        return 2
    city_lower, location_lower = city.lower(), location.lower()
    if city_lower == location_lower or city_lower in location_lower or location_lower in city_lower:
        return 0
    for related in related_locations:
        related_lower = related.lower()
        if city_lower == related_lower or city_lower in related_lower or related_lower in city_lower:
            return 1
    return 2


def _budget_tier(price: float | None, budget_band_gbp: float | None) -> int:
    """0 within (or no) budget band, 1 for a quote-only vendor, 2 for one clearly over it."""
    if budget_band_gbp is None:
        return 0
    if price is None:
        return 1
    return 0 if price <= budget_band_gbp * 1.25 else 2


def _keyword_bonus(blob: str, keywords: list[str]) -> int:
    """A more negative number for more keyword hits, so keyword matches sort first."""
    return -sum(1 for keyword in keywords if keyword.lower() in blob)


def rank_candidates(
    pool: list[VendorCandidate],
    *,
    service_key: str,
    location: str | None = None,
    related_locations: list[str] | None = None,
    budget_band_gbp: float | None = None,
    keywords: list[str] | None = None,
) -> list[VendorCandidate]:
    """The pool narrowed to `service_key`, tiered by location fit, budget fit and keyword hits."""
    related = related_locations or []
    words = keywords or []

    def sort_key(candidate: VendorCandidate) -> tuple[int, int, int, str]:
        """Best candidate first: closer location, then closer budget, then more keyword hits, then id."""
        blob = f"{candidate.business_name} {candidate.bio}".lower()
        return (
            _location_tier(candidate.city, location, related),
            _budget_tier(candidate.min_list_price_gbp, budget_band_gbp),
            _keyword_bonus(blob, words),
            candidate.user_id,
        )

    matching = [candidate for candidate in pool if service_key in candidate.services]
    return sorted(matching, key=sort_key)


def template_why_selected(
    *, business_name: str, city: str | None, location: str | None, min_list_price_gbp: float | None
) -> str:
    """A one-sentence reason built from real vendor facts only, used when the model reply is unavailable."""
    bits: list[str] = []
    if city:
        if location and (city.lower() in location.lower() or location.lower() in city.lower()):
            bits.append(f"based in {city}")
        else:
            bits.append(f"serving from {city}")
    if min_list_price_gbp is not None:
        bits.append(f"from about £{min_list_price_gbp:,.0f}")
    else:
        bits.append("price on request")
    return f"{business_name} - {'; '.join(bits)}."
