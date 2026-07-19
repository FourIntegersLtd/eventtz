"""Map celebration event types onto the five marketplace service keys."""

from __future__ import annotations

from typing import Any

# Need templates: labels celebration-specific; service_key must be one of five.
_NEED_LIBRARY: dict[str, dict[str, Any]] = {
    "food": {
        "id": "food",
        "label": "Catering",
        "service_key": "catering",
        "optional": False,
        "keywords": ["catering", "jollof", "rice", "small chops", "finger food"],
    },
    "cake": {
        "id": "cake",
        "label": "Cake",
        "service_key": "baking",
        "optional": False,
        "keywords": ["cake", "baking", "birthday cake"],
    },
    "photos": {
        "id": "photos",
        "label": "Photography",
        "service_key": "photography",
        "optional": False,
        "keywords": ["photography", "photographer", "photos"],
    },
    "glam": {
        "id": "glam",
        "label": "Makeup",
        "service_key": "makeup",
        "optional": True,
        "keywords": ["makeup", "mua", "glam"],
    },
    "hire": {
        "id": "hire",
        "label": "Decor & rentals",
        "service_key": "rentals",
        "optional": True,
        "keywords": ["rentals", "decor", "hire", "tables", "chairs"],
    },
}

# Ordered need ids per event family.
_EVENT_NEEDS: dict[str, list[tuple[str, dict[str, Any]]]] = {
    "birthdays": [
        ("food", {"label": "Food for the party", "optional": False}),
        ("cake", {"label": "Birthday cake", "optional": False}),
        ("photos", {"label": "Photos", "optional": True}),
        ("hire", {"label": "Decor & hire", "optional": True}),
        ("glam", {"label": "Makeup", "optional": True}),
    ],
    "weddings": [
        ("food", {"label": "Food for your guests", "optional": False}),
        ("cake", {"label": "Wedding cake", "optional": False}),
        ("photos", {"label": "Photos", "optional": False}),
        ("glam", {"label": "Makeup", "optional": True}),
        ("hire", {"label": "Decor & hire", "optional": True}),
    ],
    "showers": [
        ("food", {"label": "Small chops and bites", "optional": False}),
        ("cake", {"label": "Cake", "optional": False}),
        ("photos", {"label": "Photos", "optional": True}),
        ("hire", {"label": "Decor & hire", "optional": True}),
    ],
    "naming_ceremonies": [
        ("food", {"label": "Food for guests", "optional": False}),
        ("cake", {"label": "Celebration cake", "optional": False}),
        ("photos", {"label": "Photos", "optional": True}),
        ("hire", {"label": "Decor & hire", "optional": True}),
    ],
    "corporate": [
        ("food", {"label": "Catering for the event", "optional": False}),
        ("photos", {"label": "Event photography", "optional": False}),
        ("hire", {"label": "AV & room hire", "optional": True}),
    ],
    "funeral": [
        ("food", {"label": "Catering for guests", "optional": False}),
        ("photos", {"label": "Memorial photography", "optional": True}),
        ("hire", {"label": "Venue hire & setup", "optional": True}),
    ],
}

# Alias / synonym → canonical planner event key.
EVENT_ALIASES: dict[str, str] = {
    "birthday": "birthdays",
    "birthdays": "birthdays",
    "wedding": "weddings",
    "weddings": "weddings",
    "engagement": "weddings",
    "bridal": "weddings",
    "shower": "showers",
    "showers": "showers",
    "baby_shower": "showers",
    "bridal_shower": "showers",
    "naming": "naming_ceremonies",
    "naming_ceremony": "naming_ceremonies",
    "naming_ceremonies": "naming_ceremonies",
    "outdooring": "naming_ceremonies",
    "graduation": "birthdays",
    "corporate": "corporate",
    "work": "corporate",
    "office": "corporate",
    "funeral": "funeral",
    "memorial": "funeral",
    "wake": "funeral",
    "repast": "funeral",
}

# Map excluded phrasing / need ids / service keys → need ids to drop.
_EXCLUDE_ALIASES: dict[str, str] = {
    "makeup": "glam",
    "glam": "glam",
    "mua": "glam",
    "photos": "photos",
    "photography": "photos",
    "photographer": "photos",
    "cake": "cake",
    "baking": "cake",
    "baker": "cake",
    "food": "food",
    "catering": "food",
    "caterer": "food",
    "hire": "hire",
    "rentals": "hire",
    "decor": "hire",
    "rental": "hire",
}


def normalize_event_type(raw: str | None, *, event_kind: str = "standard") -> str:
    if event_kind == "funeral":
        return "funeral"
    if event_kind == "corporate":
        return "corporate"
    key = (raw or "").strip().lower().replace(" ", "_").replace("-", "_")
    if key in EVENT_ALIASES:
        return EVENT_ALIASES[key]
    if key in _EVENT_NEEDS:
        return key
    return "birthdays"


def _resolve_excluded(excluded: list[str] | None) -> set[str]:
    out: set[str] = set()
    for item in excluded or []:
        token = str(item).strip().lower().replace(" ", "_")
        if not token:
            continue
        need_id = _EXCLUDE_ALIASES.get(token, token)
        if need_id in _NEED_LIBRARY:
            out.add(need_id)
    return out


def needs_for_event(
    event_type: str | None,
    *,
    event_kind: str = "standard",
    excluded_needs: list[str] | None = None,
    cuisine_notes: str | None = None,
) -> list[dict[str, Any]]:
    """
    Return ordered need dicts: id, label, service_key, optional, keywords.

    Only uses baking, catering, photography, makeup, rentals.
    """
    canonical = normalize_event_type(event_type, event_kind=event_kind)
    template = _EVENT_NEEDS.get(canonical) or _EVENT_NEEDS["birthdays"]
    drop = _resolve_excluded(excluded_needs)

    out: list[dict[str, Any]] = []
    for need_key, overrides in template:
        if need_key in drop:
            continue
        base = dict(_NEED_LIBRARY[need_key])
        base.update(overrides)
        keywords = list(base.get("keywords") or [])
        if need_key == "food" and cuisine_notes:
            for token in str(cuisine_notes).lower().replace(",", " ").split():
                t = token.strip()
                if len(t) >= 3 and t not in keywords:
                    keywords.append(t)
            base["keywords"] = keywords[:10]
        out.append(base)
    return out
