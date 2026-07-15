"""Booking notification emails and live-update signals."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.features.realtime.sse import notify_user


def _notify_booking_changed(*, client_user_id: str | None, vendor_user_id: str | None) -> None:
    """
    Tell both users that the booking changed (live update in the app).
    Kept here so every code path that changes a booking notifies both parties.
    """
    if get_settings().local_auth_mode:
        return
    c = (client_user_id or "").strip()
    v = (vendor_user_id or "").strip()
    if c:
        notify_user(c, "booking_changed")
    if v:
        notify_user(v, "booking_changed")


def _client_booking_pricing_explanation_body(
    *,
    lead_sentence: str,
    total_label: str,
    adjustments: list[dict[str, Any]],
) -> str:
    """Notification text: opening line, pricing breakdown, and any extra costs or discounts."""
    paragraphs = [
        lead_sentence.strip(),
        (
            "The total includes your selected packages or rates, any vendor additions or "
            f"discounts, and the Eventtz service fee.\n\nTotal due: {total_label}."
        ),
    ]

    def _fmt_adj_gbp(amt: float) -> str:
        if amt >= 0:
            return f"£{amt:.2f}"
        return f"-£{abs(amt):.2f}"

    extras: list[str] = []
    for a in adjustments:
        if not isinstance(a, dict):
            continue
        label = str(a.get("label") or "Addition").strip()
        tag = str(a.get("tag") or "other").strip()
        try:
            amt = float(a.get("amount_gbp"))
        except (TypeError, ValueError):
            continue
        extras.append(f"{label} ({tag}): {_fmt_adj_gbp(amt)}")
    if extras:
        paragraphs.append("Vendor adjustments: " + "; ".join(extras) + ".")

    paragraphs.append("Please review the details on Eventtz and pay when you are ready.")
    return "\n\n".join(paragraphs)
