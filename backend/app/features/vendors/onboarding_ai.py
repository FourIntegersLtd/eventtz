"""AI helpers for vendor onboarding: bio writing and portfolio image checks."""

from __future__ import annotations

import base64
import json
import re
from difflib import SequenceMatcher
from typing import Any

from fastapi import HTTPException

from app.core.constants import OPENAI_BIO_MODEL, OPENAI_VISION_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import (
    extract_json_object,
    reasoning_kwargs_responses,
    require_openai_client,
    resolve_model,
)
from app.features.vendors import messages as vendor_messages

logger = get_logger(__name__)

_BIO_SAFE_KEYS = frozenset(
    {
        "firstName",
        "lastName",
        "businessName",
        "servicesOffered",
        "eventTypes",
        "baseCity",
        "deliveryModes",
        "travelRadius",
        "travelDeliveryPolicy",
        "travelDeliveryPolicyCustomText",
        "hourlyRate",
        "dailyRate",
        "useDefaultTravelHourly",
        "useDefaultTravelDaily",
        "packages",
        "allowQuoteRequests",
        "offerDiscounts",
        "discountPercentage",
        "discountLabel",
        "bulkDiscountThreshold",
        "bulkDiscountPercent",
        "offPeakDiscountPercent",
        "availableWeekdays",
        "blockedDates",
        "maxBookingsPerDay",
        "socialLinks",
        "portfolioFileNames",
        "isHalal",
        "allergenInfo",
    },
)


def _humanize_payload_for_bio(payload: dict[str, Any]) -> dict[str, Any]:
    """Replace raw enum keys with plain-English labels before sending to the model."""
    out = dict(payload)
    service_labels = {
        "catering": "Catering",
        "photography": "Photography",
        "videography": "Videography",
        "dj": "DJ / music band",
        "entertainment": "Entertainment",
        "decor": "Decor",
        "venue": "Venue",
        "rentals": "Rentals",
        "beauty": "Hair & makeup",
        "makeup": "Makeup",
        "hair_styling": "Hair stylist",
        "event_planning": "Event planner",
        "mc": "MC / Alaga",
        "baking": "Baking",
        "transport": "Transport",
        "cakes": "Cakes & desserts",
        "other": "Other services",
    }
    event_labels = {
        "all": "All event types",
        "weddings": "Weddings",
        "birthdays": "Birthdays",
        "corporate": "Corporate events",
        "religious": "Religious ceremonies",
        "naming_ceremonies": "Naming ceremonies",
        "funerals": "Funerals & memorials",
        "community": "Community events",
    }
    raw_services = out.get("servicesOffered")
    if isinstance(raw_services, list):
        out["servicesOffered"] = [
            service_labels.get(str(s).strip(), str(s).replace("_", " "))
            for s in raw_services
            if str(s).strip()
        ]
    raw_events = out.get("eventTypes")
    if isinstance(raw_events, list):
        if "all" in [str(e).strip() for e in raw_events]:
            out["eventTypes"] = ["All event types"]
        else:
            out["eventTypes"] = [
                event_labels.get(str(e).strip(), str(e).replace("_", " "))
                for e in raw_events
                if str(e).strip()
            ]
    return out


def _sanitize_payload_for_bio(payload: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in payload.items():
        if k in _BIO_SAFE_KEYS:
            out[k] = v
    return _humanize_payload_for_bio(out)


def generate_vendor_public_bio(*, payload: dict[str, Any]) -> str:
    client = require_openai_client(log_context="vendor_onboarding_ai")
    safe = _sanitize_payload_for_bio(payload)
    model = resolve_model(OPENAI_BIO_MODEL)
    blob = json.dumps(safe, ensure_ascii=False, indent=2)
    logger.info(
        "vendor_onboarding_ai generate-bio: start model=%s incoming_payload_keys=%s "
        "sanitized_keys=%s json_chars=%s",
        model,
        sorted(payload.keys()),
        sorted(safe.keys()),
        len(blob),
    )
    instructions = (
        "You write public-facing vendor bios for Eventtz, a UK events marketplace used heavily "
        "by Nigerian and wider African diaspora clients planning weddings, owambe, naming "
        "ceremonies, birthdays, and community celebrations.\n\n"
        "Voice: personal, warm, and direct — like a trusted vendor speaking to a client on "
        "WhatsApp, not a corporate About page. UK English spelling. Confident but humble.\n\n"
        "Structure:\n"
        "- EXACTLY ONE paragraph, 60-100 words (4-6 sentences).\n"
        "- Vary sentence length and rhythm: mix a short punchy line with a longer detail line.\n"
        "- Prefer first person plural (\"we\") or inclusive \"I\" when a first name is given; "
        "never open with \"[Name] is the proud owner of…\" or \"[Name] is a dedicated…\".\n"
        "- End with a soft invitation to enquire (e.g. message us, tell us your date, let's "
        "plan it together) — one short clause, not pushy.\n\n"
        "Content:\n"
        "- Lead with what they do and who it's for, then city/area, then one concrete detail "
        "(setup included, packages, travel radius, halal, etc.) from the JSON.\n"
        "- Name cultural events naturally when eventTypes include them (wedding, naming "
        "ceremony, etc.) — many clients search for vendors who \"get\" these occasions.\n"
        "- Be specific about services; avoid empty praise.\n\n"
        "Never use: proud owner, dedicated professional, commitment to exceptional service, "
        "seamless experience, bringing your vision to life, specialises in (prefer \"we hire "
        "out\", \"we cater for\", \"we cover\"), markdown, headings, bullet lists, camelCase, "
        "or raw JSON field names."
    )
    user_text = (
        "Structured onboarding data for this vendor (JSON). Write their public bio.\n\n"
        f"{blob}"
    )
    try:
        resp = client.responses.create(
            model=model,
            instructions=instructions,
            input=user_text,
            max_output_tokens=220,
            **reasoning_kwargs_responses(model),
        )
    except Exception as e:
        logger.exception(
            "vendor_onboarding_ai generate-bio: OpenAI responses.create failed model=%s",
            model,
        )
        raise HTTPException(
            status_code=502,
            detail=vendor_messages.AI_BIO_GENERATION_FAILED,
        ) from e
    text = (resp.output_text or "").strip()
    if not text:
        logger.warning(
            "vendor_onboarding_ai generate-bio: empty output_text from model=%s (response id may be absent)",
            model,
        )
        raise HTTPException(status_code=502, detail=vendor_messages.AI_BIO_EMPTY)
    logger.info(
        "vendor_onboarding_ai generate-bio: ok model=%s output_chars=%s",
        model,
        len(text),
    )
    return text


def analyze_portfolio_image(*, image_bytes: bytes, content_type: str) -> tuple[bool, int, str]:
    """Returns (ok, score 1-5, short summary). ok=false means the image is not good enough for the marketplace."""
    if not image_bytes:
        raise HTTPException(status_code=400, detail=vendor_messages.CHOOSE_IMAGE_TO_UPLOAD)
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=vendor_messages.ONLY_IMAGE_UPLOADS)
    client = require_openai_client(log_context="vendor_onboarding_ai")
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{b64}"
    prompt = (
        "You review photos for a professional events marketplace portfolio. "
        "Assess: sharpness/focus, exposure, noise, composition, and whether it looks "
        "professional enough to show clients. "
        "Respond with a single JSON object ONLY (no markdown): "
        '{"ok": true or false, "score": 1-5, "summary": "one short sentence"}. '
        "Set ok to false if the image is very blurry, extremely dark or blown out, "
        "tiny resolution, mostly empty, or clearly unsuitable as a portfolio showcase."
    )
    input_msg: list[dict[str, Any]] = [
        {
            "role": "user",
            "type": "message",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": data_url, "detail": "low"},
            ],
        }
    ]
    model = resolve_model(OPENAI_VISION_MODEL)
    resp = client.responses.create(
        model=model,
        input=input_msg,
        max_output_tokens=300,
        **reasoning_kwargs_responses(model),
    )
    raw = (resp.output_text or "").strip()
    if not raw:
        raise HTTPException(status_code=502, detail=vendor_messages.COULD_NOT_ANALYSE_IMAGE)
    try:
        parsed = extract_json_object(raw)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("portfolio image QA parse failed: %s", raw[:200])
        raise HTTPException(
            status_code=502,
            detail=vendor_messages.COULD_NOT_ANALYSE_IMAGE,
        ) from e
    ok = bool(parsed.get("ok"))
    score = int(parsed.get("score", 3))
    if score < 1:
        score = 1
    if score > 5:
        score = 5
    summary = str(parsed.get("summary") or "").strip() or "No summary returned."
    return ok, score, summary


_PACKAGE_REVIEW_SAFE_KEYS = frozenset(
    {
        "businessName",
        "servicesOffered",
        "eventTypes",
        "packages",
        "aiBioDraft",
        "portfolioFileNames",
        "hourlyRate",
        "dailyRate",
    },
)

_CATEGORY_EXAMPLES: dict[str, str] = {
    "catering": "Small Chops – £40: 10 spring rolls, 10 samosas, 10 puff-puff, 5 peppered gizzard.",
    "baking": "Celebration Cake – £120: two-tier cake, serves 30, standard flavours, delivery within 10 miles.",
    "makeup": "Silver Bridal Makeup – £300: bridal makeup on the day, lashes, skin prep, touch-up kit.",
    "photography": "Wedding Photography – £1,500: up to 8 hours, edited digital gallery, online sharing.",
    "rentals": "Chair hire – £2 each: white folding chairs, 3-day hire, delivery and collection within 10 miles.",
    "event_planning": "Full Day Coordination – £800: timeline planning, vendor liaison, on-the-day management up to 10 hours.",
    "decor": "Gold Decor Package – £450: backdrop, balloon garland, table centrepieces for up to 10 tables.",
    "dj": "Wedding DJ – £600: 5 hours, professional sound system, dancefloor lighting.",
    "mc": "Wedding MC – £350: bilingual hosting, ceremony coordination, reception announcements.",
    "hair_styling": "Bridal Hair Styling – £200: consultation, trial, styling on the wedding day.",
}


def _category_context(services: list[Any]) -> str:
    lines: list[str] = []
    for raw in services:
        key = str(raw).strip()
        if key in _CATEGORY_EXAMPLES:
            lines.append(_CATEGORY_EXAMPLES[key])
    return "\n".join(lines) if lines else "Each package needs a clear name, price, and specific what's included."


def _sanitize_payload_for_package_review(payload: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in payload.items():
        if k in _PACKAGE_REVIEW_SAFE_KEYS:
            out[k] = v
    pkgs = out.get("packages")
    if isinstance(pkgs, list):
        cleaned: list[dict[str, Any]] = []
        for item in pkgs[:12]:
            if not isinstance(item, dict):
                continue
            cleaned.append(
                {
                    "id": str(item.get("id") or ""),
                    "title": str(item.get("title") or "").strip()[:120],
                    "price": str(item.get("price") or "").strip()[:32],
                    "details": str(item.get("details") or "").strip()[:600],
                    "duration": str(item.get("duration") or "").strip()[:80],
                    "pricingMode": str(item.get("pricingMode") or "fixed").strip()[:20],
                    "unitLabel": str(item.get("unitLabel") or "").strip()[:40],
                    "minQuantity": str(item.get("minQuantity") or "").strip()[:12],
                    "maxQuantity": str(item.get("maxQuantity") or "").strip()[:12],
                },
            )
        out["packages"] = cleaned
    names = out.get("portfolioFileNames")
    out["portfolio_count"] = len(names) if isinstance(names, list) else 0
    bio = str(out.get("aiBioDraft") or "").strip()
    out["bio_excerpt"] = bio[:400]
    out.pop("aiBioDraft", None)
    out.pop("portfolioFileNames", None)
    svcs = out.get("servicesOffered")
    if isinstance(svcs, list):
        out["category_examples"] = _category_context(svcs)
    return out


def _normalize_package_feedback(raw: Any) -> list[dict[str, Any]]:
    """Parse grouped package feedback from model output."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for entry in raw[:6]:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("package_title") or entry.get("title") or "").strip()
        if not title:
            continue
        items_raw = entry.get("items")
        items: list[str] = []
        if isinstance(items_raw, list):
            for item in items_raw[:5]:
                text = str(item).strip()
                if text:
                    items.append(text[:320])
        pkg_id = entry.get("package_id")
        suggested_title = str(entry.get("suggested_title") or "").strip()[:120] or None
        suggested_details = str(entry.get("suggested_details") or "").strip()[:800] or None
        suggested_duration = str(entry.get("suggested_duration") or "").strip()[:80] or None
        has_suggestions = bool(suggested_title or suggested_details or suggested_duration)
        if not items and not has_suggestions:
            continue
        out.append(
            {
                "package_id": str(pkg_id).strip() if pkg_id else None,
                "package_title": title[:120],
                "items": items,
                "suggested_title": suggested_title,
                "suggested_details": suggested_details,
                "suggested_duration": suggested_duration,
            },
        )
    return out


def _norm_compare_text(value: str) -> str:
    return re.sub(r"[^\w\s]", " ", value.lower()).strip()


def _text_similarity(a: str, b: str) -> float:
    na, nb = _norm_compare_text(a), _norm_compare_text(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def _title_word_count(title: str) -> int:
    return len([part for part in re.split(r"\s+", title.strip()) if part])


def _filter_weak_package_suggestions(
    feedback: list[dict[str, Any]],
    packages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Drop AI suggestions that are too short, too similar, or weaker than the input."""
    by_id = {str(pkg.get("id") or ""): pkg for pkg in packages if isinstance(pkg, dict)}
    by_title = {
        _norm_compare_text(str(pkg.get("title") or "")): pkg
        for pkg in packages
        if isinstance(pkg, dict)
    }

    filtered: list[dict[str, Any]] = []
    for entry in feedback:
        pkg: dict[str, Any] | None = None
        pkg_id = str(entry.get("package_id") or "").strip()
        if pkg_id and pkg_id in by_id:
            pkg = by_id[pkg_id]
        else:
            pkg = by_title.get(_norm_compare_text(str(entry.get("package_title") or "")))

        suggested_title = entry.get("suggested_title")
        suggested_details = entry.get("suggested_details")
        suggested_duration = entry.get("suggested_duration")

        if isinstance(suggested_title, str):
            title = suggested_title.strip()
            original_title = str(pkg.get("title") or "").strip() if pkg else ""
            if _title_word_count(title) < 3:
                suggested_title = None
            elif original_title and _text_similarity(title, original_title) >= 0.72:
                suggested_title = None
            elif len(title) <= len(original_title) and _text_similarity(title, original_title) >= 0.55:
                suggested_title = None
            else:
                suggested_title = title[:120]

        if isinstance(suggested_details, str):
            details = suggested_details.strip()
            original_details = str(pkg.get("details") or "").strip() if pkg else ""
            if original_details and _text_similarity(details, original_details) >= 0.68:
                suggested_details = None
            elif len(details) < 40:
                suggested_details = None
            else:
                suggested_details = details[:800]

        if isinstance(suggested_duration, str):
            duration = suggested_duration.strip()
            original_duration = str(pkg.get("duration") or "").strip() if pkg else ""
            if original_duration and _text_similarity(duration, original_duration) >= 0.8:
                suggested_duration = None
            else:
                suggested_duration = duration[:80]

        has_suggestions = bool(suggested_title or suggested_details or suggested_duration)
        items = entry.get("items") if isinstance(entry.get("items"), list) else []
        if not has_suggestions and not items:
            continue

        filtered.append(
            {
                **entry,
                "suggested_title": suggested_title,
                "suggested_details": suggested_details,
                "suggested_duration": suggested_duration,
            },
        )
    return filtered


def _group_flat_tips(tips: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fallback: merge legacy flat tips into one card per package."""
    grouped: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for tip in tips:
        title = str(tip.get("package_title") or "").strip() or "Overall"
        key = str(tip.get("package_id") or title).strip()
        if key not in grouped:
            grouped[key] = {
                "package_id": tip.get("package_id"),
                "package_title": title,
                "items": [],
            }
            order.append(key)
        message = str(tip.get("message") or "").strip()
        if message and message not in grouped[key]["items"]:
            grouped[key]["items"].append(message[:320])
    return [grouped[k] for k in order if grouped[k]["items"]]


def review_vendor_packages(*, payload: dict[str, Any]) -> dict[str, Any]:
    """AI coaching for package clarity — suggestions only, never blocks submission."""
    client = require_openai_client(log_context="vendor_onboarding_ai")
    safe = _sanitize_payload_for_package_review(payload)
    model = resolve_model(OPENAI_BIO_MODEL)
    blob = json.dumps(safe, ensure_ascii=False, indent=2)
    instructions = (
        "You are a friendly UK events marketplace coach helping vendors write bookable packages "
        "for Eventtz (weddings, owambe, birthdays, naming ceremonies).\n\n"
        "A package = one option a client can choose and book (name + price + what's included).\n\n"
        "Return JSON ONLY with this shape:\n"
        "{\n"
        '  "overall_ok": true,\n'
        '  "summary": "one encouraging sentence about overall package quality",\n'
        '  "package_feedback": [\n'
        "    {\n"
        '      "package_id": "id from input when applicable",\n'
        '      "package_title": "exact package name from input",\n'
        '      "items": [],\n'
        '      "suggested_title": "rewritten package name or null if fine",\n'
        '      "suggested_details": "concise what\'s included line or null if fine",\n'
        '      "suggested_duration": "rewritten duration or null if not applicable"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Output rules:\n"
        "- ONE package_feedback entry per package that needs work.\n"
        "- suggested_* fields are pasted directly into the vendor form — write final copy, not advice.\n"
        "- ALWAYS rewrite weak packages. Do NOT return near-copies of the vendor's existing text.\n"
        "- suggested_title: 3–8 words, specific and bookable. Follow category_examples naming:\n"
        "  • rentals: \"Chair hire\", \"Table hire\" (prefer per-item rates over fixed packs)\n"
        "  • catering: \"Small Chops – Large Pack\"\n"
        "  • photography: \"Wedding Photography\", \"Birthday Photography\"\n"
        "  Never use Gold/Silver/Package 1/Chairs/Tables alone.\n"
        "- suggested_details: one factual line (40–100 chars) in the same style as category_examples.\n"
        "  Must ADD concrete specifics missing from the input — quantities, hire period, headcount, "
        "deliverables, delivery/collection. Comma-separated facts only; no marketing fluff.\n"
        "  Good: \"50 white folding chairs, 3-day hire, delivery and collection within 10 miles.\"\n"
        "  Bad: repeating the vendor text with tiny edits, or \"chairs and tables for your event\".\n"
        "- Put time/coverage in suggested_duration (e.g. \"3-day hire\", \"Up to 8 hours\"), not in details.\n"
        "- If the vendor text is already as clear as category_examples, return null for that field.\n"
        "- Leave items as an empty array when filling suggested_* fields.\n"
        "- Keep the vendor's price unchanged — do not invent prices.\n"
        "- Match package_id and package_title from input.\n"
        "- For profile-wide issues only, use package_title \"Overall\" with items only (no suggested_* fields).\n"
        "- Max 4 package_feedback entries total.\n\n"
        "Review intelligently:\n"
        "- Missing packages for selected services.\n"
        "- Vague wording, generic names (Package 1, Gold/Silver without context).\n"
        "- Food without quantities; photography without hours/deliverables.\n"
        "- Duration ambiguity (setup vs event time).\n"
        "- Bio/service mismatch.\n\n"
        "Rules:\n"
        "- overall_ok must always be true.\n"
        "- Never say the profile will be rejected.\n"
        "- UK English, warm and practical.\n"
        "- If packages are strong, return empty package_feedback and a positive summary."
    )
    user_text = (
        "Review this vendor's packages. Use category_examples as quality benchmarks.\n\n"
        f"{blob}"
    )
    try:
        resp = client.responses.create(
            model=model,
            instructions=instructions,
            input=user_text,
            max_output_tokens=1400,
            **reasoning_kwargs_responses(model),
        )
    except Exception as e:
        logger.exception("vendor_onboarding_ai review-packages failed model=%s", model)
        raise HTTPException(
            status_code=502,
            detail=vendor_messages.PACKAGE_REVIEW_FAILED,
        ) from e
    raw = (resp.output_text or "").strip()
    try:
        parsed = extract_json_object(raw)
    except Exception as e:
        logger.warning("package review parse failed: %s", raw[:200])
        raise HTTPException(
            status_code=502,
            detail=vendor_messages.COULD_NOT_READ_PACKAGE_SUGGESTIONS,
        ) from e
    summary = str(parsed.get("summary") or "").strip()[:400]
    package_feedback = _normalize_package_feedback(parsed.get("package_feedback"))
    package_feedback = _filter_weak_package_suggestions(
        package_feedback,
        safe.get("packages") if isinstance(safe.get("packages"), list) else [],
    )

    tips_raw = parsed.get("tips")
    legacy_tips: list[dict[str, Any]] = []
    if isinstance(tips_raw, list):
        for item in tips_raw[:8]:
            if not isinstance(item, dict):
                continue
            message = str(item.get("message") or "").strip()
            if not message:
                continue
            pkg_id = item.get("package_id")
            pkg_title = item.get("package_title")
            legacy_tips.append(
                {
                    "severity": str(item.get("severity") or "tip"),
                    "package_id": str(pkg_id).strip() if pkg_id else None,
                    "package_title": str(pkg_title).strip() if pkg_title else None,
                    "code": str(item.get("code") or "suggestion").strip()[:64],
                    "message": message[:280],
                },
            )

    if not package_feedback and legacy_tips:
        package_feedback = _group_flat_tips(legacy_tips)

    if not summary and not package_feedback:
        summary = "Your packages look clear — clients should understand what they're booking."
    return {
        "overall_ok": True,
        "summary": summary,
        "package_feedback": package_feedback,
        "tips": legacy_tips,
    }
