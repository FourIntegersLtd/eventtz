"""Parse a celebration prompt into CelebrationBrief (plan path only)."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.contracts.planner import CelebrationBrief
from app.core.constants import OPENAI_PLANNER_MODEL
from app.core.errors import ValidationError
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, try_openai_client
from app.features.planner.category_planner import EVENT_ALIASES, normalize_event_type
from app.features.planner.defaults import DEFAULT_GUEST_COUNT, MAX_PROMPT_LENGTH
from app.features.vendors.search_ai import parse_marketplace_query
from app.features.vendors.taxonomy import filter_service_keys

logger = get_logger(__name__)

_SIMPLE_INTENT_MSG = "This looks like a simple vendor search. Try Browse instead."

_ALPHA_RE = re.compile(r"[a-zA-Z]{2,}")
_EMOJI_HEAVY_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U0001F600-\U0001F64F"
    "]+",
    flags=re.UNICODE,
)

_BUDGET_RE = re.compile(
    r"(?P<sym>£|\$|€|₦|naira|gbp|usd|eur)?\s*"
    r"(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*"
    r"(?P<suffix>k|thousand)?\b"
    r"|\b(?P<num2>\d+(?:\.\d+)?)\s*(?P<suffix2>k)\b",
    re.I,
)
_GUEST_RE = re.compile(
    r"\b(?P<n>\d{1,4})\s*(?:guests?|people|pax|attendees?)\b"
    r"|\b(?:for|about|around)\s+(?P<n2>\d{1,4})\s*(?:guests?|people)?\b",
    re.I,
)
_DATE_ISO_RE = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_EXCLUDE_RE = re.compile(
    r"\b(?:no|without|skip|don'?t\s+need|do\s+not\s+need)\s+"
    r"(?P<need>makeup|glam|mua|photos?|photography|cake|baking|catering|food|rentals?|decor|hire)\b",
    re.I,
)
_FUNERAL_RE = re.compile(r"\b(funeral|memorial|wake|repast|bereavement)\b", re.I)
_CORPORATE_RE = re.compile(r"\b(corporate|company|office|work\s+event|conference|team\s+offsite)\b", re.I)
_LOCATION_HINT_RE = re.compile(
    r"\b(?:in|at|near|around)\s+([A-Za-z][A-Za-z\s\-']{1,40})",
    re.I,
)

_SERVICE_HUNT_RE = re.compile(
    r"\b("
    + "|".join(
        sorted(
            {
                "baker",
                "bakers",
                "bakery",
                "baking",
                "cake",
                "cakes",
                "caterer",
                "caterers",
                "catering",
                "photographer",
                "photographers",
                "photography",
                "makeup",
                "mua",
                "rentals",
                "rental",
                "hire",
                "decor",
            },
        ),
    )
    + r")\b",
    re.I,
)

_UNSUPPORTED_RE = re.compile(r"\b(dj|mc|emcee|videographer|video|band|live\s+band)\b", re.I)


class _LlmCelebrationBrief(BaseModel):
    event_type: str | None = None
    event_kind: Literal["funeral", "corporate", "standard"] = "standard"
    location: str | None = None
    related_locations: list[str] = Field(default_factory=list)
    guest_count: int | None = None
    budget_gbp: float | None = None
    preferred_date: str | None = None
    indoor_outdoor: str | None = None
    cuisine_notes: str | None = None
    music_notes: str | None = None
    special_requirements: str | None = None
    excluded_needs: list[str] = Field(default_factory=list)
    currency_assumed_gbp: bool = False
    unsupported_categories_mentioned: list[str] = Field(default_factory=list)


def _looks_like_nonsense(prompt: str) -> bool:
    text = (prompt or "").strip()
    if not text:
        return True
    if not _ALPHA_RE.search(text):
        return True
    letters = len(re.findall(r"[a-zA-Z]", text))
    emoji_chars = len(_EMOJI_HEAVY_RE.findall(text))
    if letters < 3 and emoji_chars > 0:
        return True
    # Mostly non-letter noise
    if letters < 3 and len(text) >= 3:
        return True
    return False


def _single_service_hunt(prompt: str, marketplace_types: list[str]) -> bool:
    """
    Prefer simple browse when the user is clearly hunting one service + place,
    even if a plan verb appears (e.g. 'plan baking in Leeds').
    """
    types = filter_service_keys(marketplace_types)
    if len(types) == 1:
        # Explicit multi-need language keeps plan
        if re.search(r"\b(and|plus|also|with)\b", prompt, re.I) and re.search(
            r"\b(cake|food|cater|photo|makeup|decor|rental|hire|vendor|vendors)\b",
            prompt,
            re.I,
        ):
            # "food and cake" → plan; "baking in Leeds" stays simple
            services_mentioned = set(_SERVICE_HUNT_RE.findall(prompt.lower()))
            mapped = set()
            for s in services_mentioned:
                if s in ("baker", "bakers", "bakery", "baking", "cake", "cakes"):
                    mapped.add("baking")
                elif s in ("caterer", "caterers", "catering"):
                    mapped.add("catering")
                elif s in ("photographer", "photographers", "photography"):
                    mapped.add("photography")
                elif s in ("makeup", "mua"):
                    mapped.add("makeup")
                elif s in ("rentals", "rental", "hire", "decor"):
                    mapped.add("rentals")
            if len(mapped) >= 2:
                return False
        return True
    # Fallback: one service keyword family and no event celebration wording
    hits = _SERVICE_HUNT_RE.findall(prompt)
    if not hits:
        return False
    mapped_services: set[str] = set()
    for h in hits:
        low = h.lower()
        if low in ("baker", "bakers", "bakery", "baking", "cake", "cakes"):
            mapped_services.add("baking")
        elif low in ("caterer", "caterers", "catering"):
            mapped_services.add("catering")
        elif low in ("photographer", "photographers", "photography"):
            mapped_services.add("photography")
        elif low in ("makeup", "mua"):
            mapped_services.add("makeup")
        elif low in ("rentals", "rental", "hire", "decor"):
            mapped_services.add("rentals")
    if len(mapped_services) != 1:
        return False
    if re.search(
        r"\b(birthday|wedding|shower|naming|engagement|funeral|memorial|corporate|"
        r"celebration|guests?|organise|organize|what\s+do\s+i\s+need)\b",
        prompt,
        re.I,
    ):
        return False
    return True


def _parse_budget(text: str) -> tuple[float | None, bool]:
    """Return (amount_gbp, currency_assumed_gbp)."""
    assumed = False
    best: float | None = None
    for m in _BUDGET_RE.finditer(text):
        sym = (m.group("sym") or "").lower()
        num_s = m.group("num") or m.group("num2")
        suffix = (m.group("suffix") or m.group("suffix2") or "").lower()
        if not num_s:
            continue
        try:
            value = float(num_s.replace(",", ""))
        except ValueError:
            continue
        if suffix in ("k", "thousand"):
            value *= 1000
        if value < 20 or value > 5_000_000:
            continue
        if sym and sym not in ("£", "gbp"):
            assumed = True
        if "budget" in text.lower() or sym or suffix:
            best = value
            break
        if best is None and (sym or suffix or value >= 100):
            best = value
    # Prefer explicit budget phrasing
    m2 = re.search(
        r"(?:budget|under|upto|up\s+to|around|about)\s*"
        r"(?:of\s+)?(?P<sym>£|\$|€|₦)?\s*(?P<num>\d[\d,]*(?:\.\d+)?)\s*(?P<suf>k)?",
        text,
        re.I,
    )
    if m2:
        try:
            value = float(m2.group("num").replace(",", ""))
            if (m2.group("suf") or "").lower() == "k":
                value *= 1000
            best = value
            sym = (m2.group("sym") or "").lower()
            if sym and sym not in ("£",):
                assumed = True
        except ValueError:
            pass
    return best, assumed


def _parse_guests(text: str) -> int | None:
    m = _GUEST_RE.search(text)
    if not m:
        # "my 30th" is age, not guests — ignore bare numbers
        return None
    raw = m.group("n") or m.group("n2")
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return None
    if 1 <= n <= 10000:
        return n
    return None


def _parse_date(text: str) -> tuple[str | None, bool]:
    """Return (iso_date, preferred_date_invalid)."""
    m = _DATE_ISO_RE.search(text)
    if m:
        iso = m.group(1)
        try:
            d = date.fromisoformat(iso)
            return iso, d < date.today()
        except ValueError:
            return iso, False
    # Common UK-ish patterns: 12 July 2026 / 12th July
    m2 = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"(?:\s+(\d{4}))?\b",
        text,
        re.I,
    )
    if m2:
        day = int(m2.group(1))
        month_name = m2.group(2).lower()
        months = {
            "january": 1,
            "february": 2,
            "march": 3,
            "april": 4,
            "may": 5,
            "june": 6,
            "july": 7,
            "august": 8,
            "september": 9,
            "october": 10,
            "november": 11,
            "december": 12,
        }
        year = int(m2.group(3) or date.today().year)
        month = months[month_name]
        try:
            d = date(year, month, day)
            # If month already passed and year omitted, roll to next year only when future-ish
            if not m2.group(3) and d < date.today():
                d = date(year + 1, month, day)
            return d.isoformat(), d < date.today()
        except ValueError:
            return None, False
    return None, False


def _detect_event_kind(text: str) -> Literal["funeral", "corporate", "standard"]:
    if _FUNERAL_RE.search(text):
        return "funeral"
    if _CORPORATE_RE.search(text):
        return "corporate"
    return "standard"


def _detect_event_type(text: str, *, event_kind: str) -> str | None:
    if event_kind == "funeral":
        return "funeral"
    if event_kind == "corporate":
        return "corporate"
    low = text.lower()
    for alias, canonical in EVENT_ALIASES.items():
        if canonical in ("funeral", "corporate"):
            continue
        pattern = alias.replace("_", r"[\s_]+")
        if re.search(rf"\b{pattern}\b", low):
            return canonical
    return None


def _detect_excluded(text: str) -> list[str]:
    out: list[str] = []
    for m in _EXCLUDE_RE.finditer(text):
        need = m.group("need").lower()
        if need not in out:
            out.append(need)
    if re.search(r"\b(food and cake only|cake and food only|only food and cake)\b", text, re.I):
        for n in ("photos", "photography", "makeup", "rentals", "decor", "hire"):
            if n not in out:
                out.append(n)
    return out


def _detect_unsupported(text: str) -> list[str]:
    found: list[str] = []
    for m in _UNSUPPORTED_RE.finditer(text):
        token = m.group(0).lower()
        if "video" in token:
            label = "videographer"
        elif token in ("mc", "emcee"):
            label = "mc"
        else:
            label = token
        if label not in found:
            found.append(label)
    return found


def _canned_brief(prompt: str, *, marketplace_location: str | None) -> CelebrationBrief:
    event_kind = _detect_event_kind(prompt)
    event_type = _detect_event_type(prompt, event_kind=event_kind)
    if not event_type:
        event_type = normalize_event_type(None, event_kind=event_kind)

    budget, assumed = _parse_budget(prompt)
    guests = _parse_guests(prompt)
    preferred_date, date_invalid = _parse_date(prompt)
    excluded = _detect_excluded(prompt)
    unsupported = _detect_unsupported(prompt)

    location = marketplace_location
    if not location:
        m = _LOCATION_HINT_RE.search(prompt)
        if m:
            loc = m.group(1).strip(" .,")
            # Stop at common trailing words
            loc = re.split(r"\b(for|with|on|under|budget|guests?)\b", loc, maxsplit=1)[0].strip()
            if loc and len(loc) <= 60:
                location = loc

    related: list[str] = []
    # "London or Manchester"
    m_or = re.search(
        r"\b([A-Za-z][A-Za-z\s\-']{1,30})\s+or\s+([A-Za-z][A-Za-z\s\-']{1,30})\b",
        prompt,
        re.I,
    )
    if m_or:
        first = m_or.group(1).strip()
        second = m_or.group(2).strip()
        if not location:
            location = first
        if second and second.lower() != (location or "").lower():
            related.append(second)

    cuisine = None
    for token in ("jollof", "halal", "vegan", "small chops", "puff-puff", "puff puff"):
        if token in prompt.lower():
            cuisine = (cuisine + ", " if cuisine else "") + token

    indoor_outdoor = None
    if re.search(r"\bindoor\b", prompt, re.I):
        indoor_outdoor = "indoor"
    elif re.search(r"\boutdoor\b", prompt, re.I):
        indoor_outdoor = "outdoor"

    return CelebrationBrief(
        event_type=event_type,
        event_kind=event_kind,
        location=location,
        related_locations=related,
        guest_count=guests,
        budget_gbp=budget,
        preferred_date=preferred_date,
        preferred_date_invalid=date_invalid,
        indoor_outdoor=indoor_outdoor,
        cuisine_notes=cuisine,
        music_notes=None,
        special_requirements=None,
        excluded_needs=excluded,
        currency_assumed_gbp=assumed,
        raw_prompt=prompt.strip()[:MAX_PROMPT_LENGTH],
        unsupported_categories_mentioned=unsupported,
    )


def _llm_brief(prompt: str) -> CelebrationBrief | None:
    client = try_openai_client()
    if client is None:
        return None
    system = (
        "You extract a structured celebration brief for Eventtz, a UK events marketplace "
        "for African and diaspora celebrations. Only fill fields clearly supported by the text. "
        "event_type aliases: engagement→weddings, graduation→birthdays, funeral/memorial→funeral, "
        "corporate/office→corporate. Allowed celebration types: birthdays, weddings, showers, "
        "naming_ceremonies, corporate, funeral. "
        "Use event_kind funeral|corporate|standard. "
        "Budget numbers without £ are still GBP for GB market — set currency_assumed_gbp true "
        "when the symbol is not £. "
        "excluded_needs: services the user said they do not want (makeup, photos, cake, etc.). "
        "unsupported_categories_mentioned: dj, mc, videographer if mentioned."
    )
    user = f"Celebration prompt:\n{prompt.strip()}"
    try:
        parsed = parse_completion(
            client=client,
            model=OPENAI_PLANNER_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=_LlmCelebrationBrief,
            log_context="planner_brief",
        )
    except Exception as e:
        logger.warning("planner prompt_parser: LLM brief failed: %s", e)
        return None

    data = parsed.model_dump() if isinstance(parsed, BaseModel) else dict(parsed)
    event_kind = str(data.get("event_kind") or "standard")
    if event_kind not in ("funeral", "corporate", "standard"):
        event_kind = "standard"
    event_type = normalize_event_type(data.get("event_type"), event_kind=event_kind)

    preferred_date = data.get("preferred_date")
    date_invalid = False
    if preferred_date:
        try:
            d = date.fromisoformat(str(preferred_date)[:10])
            date_invalid = d < date.today()
            preferred_date = d.isoformat()
        except ValueError:
            preferred_date = str(preferred_date)[:32]
            date_invalid = False

    guests = data.get("guest_count")
    try:
        guest_count = int(guests) if guests is not None else None
    except (TypeError, ValueError):
        guest_count = None

    budget = data.get("budget_gbp")
    try:
        budget_gbp = float(budget) if budget is not None else None
    except (TypeError, ValueError):
        budget_gbp = None

    return CelebrationBrief(
        event_type=event_type,
        event_kind=event_kind,  # type: ignore[arg-type]
        location=(str(data["location"]).strip()[:120] if data.get("location") else None),
        related_locations=[
            str(x).strip()[:80]
            for x in (data.get("related_locations") or [])
            if str(x).strip()
        ][:8],
        guest_count=guest_count,
        budget_gbp=budget_gbp,
        preferred_date=preferred_date,
        preferred_date_invalid=date_invalid,
        indoor_outdoor=(
            str(data["indoor_outdoor"]).strip()[:40] if data.get("indoor_outdoor") else None
        ),
        cuisine_notes=(
            str(data["cuisine_notes"]).strip()[:200] if data.get("cuisine_notes") else None
        ),
        music_notes=(str(data["music_notes"]).strip()[:200] if data.get("music_notes") else None),
        special_requirements=(
            str(data["special_requirements"]).strip()[:400]
            if data.get("special_requirements")
            else None
        ),
        excluded_needs=[
            str(x).strip().lower()
            for x in (data.get("excluded_needs") or [])
            if str(x).strip()
        ][:12],
        currency_assumed_gbp=bool(data.get("currency_assumed_gbp")),
        raw_prompt=prompt.strip()[:MAX_PROMPT_LENGTH],
        unsupported_categories_mentioned=[
            str(x).strip().lower()
            for x in (data.get("unsupported_categories_mentioned") or [])
            if str(x).strip()
        ][:8],
    )


def parse_celebration_prompt(prompt: str, *, country_code: str | None = "GB") -> CelebrationBrief:
    """
    Classify intent then parse CelebrationBrief.

    Raises ValidationError(code='simple_intent') for browse-style queries.
    Raises ValidationError for nonsense / empty prompts.
    """
    text = (prompt or "").strip()
    if len(text) > MAX_PROMPT_LENGTH:
        text = text[:MAX_PROMPT_LENGTH]
    if _looks_like_nonsense(text):
        raise ValidationError(
            "Describe your celebration in a few words — for example a birthday in London for 80 guests.",
            code="invalid_prompt",
        )

    marketplace = parse_marketplace_query(text, country_code=country_code)
    types = list(marketplace.types or [])

    if marketplace.mode == "simple" or _single_service_hunt(text, types):
        # Extra guard: pure single-service city hunts never become plans
        raise ValidationError(_SIMPLE_INTENT_MSG, code="simple_intent")

    # If marketplace said plan but types is a single service and prompt is short hunt-like
    if len(filter_service_keys(types)) == 1 and not re.search(
        r"\b(birthday|wedding|shower|naming|engagement|funeral|memorial|corporate|"
        r"celebration|guests?|help\s+me\s+plan|organise|organize)\b",
        text,
        re.I,
    ):
        raise ValidationError(_SIMPLE_INTENT_MSG, code="simple_intent")

    brief = _llm_brief(text)
    if brief is None:
        brief = _canned_brief(text, marketplace_location=marketplace.location)
    else:
        # Fill gaps from canned heuristics
        canned = _canned_brief(text, marketplace_location=marketplace.location)
        if not brief.location and canned.location:
            brief.location = canned.location
        if brief.guest_count is None and canned.guest_count is not None:
            brief.guest_count = canned.guest_count
        if brief.budget_gbp is None and canned.budget_gbp is not None:
            brief.budget_gbp = canned.budget_gbp
            brief.currency_assumed_gbp = canned.currency_assumed_gbp
        if not brief.preferred_date and canned.preferred_date:
            brief.preferred_date = canned.preferred_date
            brief.preferred_date_invalid = canned.preferred_date_invalid
        if not brief.excluded_needs and canned.excluded_needs:
            brief.excluded_needs = canned.excluded_needs
        if not brief.unsupported_categories_mentioned and canned.unsupported_categories_mentioned:
            brief.unsupported_categories_mentioned = canned.unsupported_categories_mentioned
        if marketplace.location and not brief.location:
            brief.location = marketplace.location
        if marketplace.related_locations and not brief.related_locations:
            brief.related_locations = list(marketplace.related_locations)[:8]

    brief.raw_prompt = text
    # Guest count used later for catering estimates; leave None on brief if unknown
    # (defaults applied at estimate time only).
    if not brief.event_type:
        brief.event_type = normalize_event_type(None, event_kind=brief.event_kind)

    logger.info(
        "planner_parse: event_type=%s kind=%s location=%s guests=%s budget=%s",
        brief.event_type,
        brief.event_kind,
        brief.location,
        brief.guest_count,
        brief.budget_gbp,
    )
    return brief


# Exported for tests
canned_celebration_brief = _canned_brief
looks_like_nonsense = _looks_like_nonsense
DEFAULT_GUEST_COUNT_FOR_ESTIMATE = DEFAULT_GUEST_COUNT
