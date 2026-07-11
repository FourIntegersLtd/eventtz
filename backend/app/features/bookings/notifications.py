"""Booking notification side-effects and copy helpers."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.features.realtime.sse import notify_user


def _notify_booking_changed(*, client_user_id: str | None, vendor_user_id: str | None) -> None:
    """
    Emit the lightweight SSE signal that booking state changed.
    Keep this in the service layer so endpoints can't accidentally miss counterpart updates.
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
    """In-app notification copy: headline total + optional vendor addition lines."""
    msg = (
        f"{lead_sentence.strip()} "
        f"The amount includes your selected packages/rates, any vendor additions or discounts, "
        f"and the Eventtz service fee. Total due: {total_label}."
    )

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
        msg += " Vendor adjustments: " + "; ".join(extras) + "."
    return msg
