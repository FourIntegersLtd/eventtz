"""Build grounded FactCards from real vendor fields only (no invented stats)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FactCard:
    user_id: str
    business_name: str
    base_city: str | None
    review_average: float | None
    review_count: int
    completed_bookings: int
    avg_response_seconds: float | None
    conversion_rate: float | None
    min_list_price_gbp: float | None
    services: list[str]
    price_on_request: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "business_name": self.business_name,
            "base_city": self.base_city,
            "review_average": self.review_average,
            "review_count": self.review_count,
            "completed_bookings": self.completed_bookings,
            "avg_response_seconds": self.avg_response_seconds,
            "conversion_rate": self.conversion_rate,
            "min_list_price_gbp": self.min_list_price_gbp,
            "services": list(self.services),
            "price_on_request": self.price_on_request,
        }


def _payload(row: dict[str, Any]) -> dict[str, Any]:
    p = row.get("payload")
    return p if isinstance(p, dict) else {}


def build_fact_card(row: dict[str, Any]) -> FactCard:
    """FactCard from explore/public metric fields only — never invent numbers."""
    payload = _payload(row)
    services_raw = payload.get("servicesOffered")
    if not isinstance(services_raw, list):
        services_raw = row.get("services_offered") if isinstance(row.get("services_offered"), list) else []
    services = [str(s).strip() for s in (services_raw or []) if str(s).strip()]

    price = row.get("min_list_price_gbp")
    if price is None:
        price = payload.get("min_list_price_gbp")
    try:
        min_price = float(price) if price is not None else None
    except (TypeError, ValueError):
        min_price = None

    avg = row.get("review_average")
    try:
        review_avg = float(avg) if avg is not None else None
    except (TypeError, ValueError):
        review_avg = None

    city = str(payload.get("baseCity") or row.get("base_city_normalized") or "").strip() or None
    name = str(payload.get("businessName") or "").strip()

    return FactCard(
        user_id=str(row.get("user_id") or ""),
        business_name=name,
        base_city=city,
        review_average=review_avg,
        review_count=int(row.get("review_count") or 0),
        completed_bookings=int(row.get("completed_bookings") or 0),
        avg_response_seconds=(
            float(row["avg_response_seconds"])
            if row.get("avg_response_seconds") is not None
            else None
        ),
        conversion_rate=(
            float(row["conversion_rate"]) if row.get("conversion_rate") is not None else None
        ),
        min_list_price_gbp=min_price,
        services=services,
        price_on_request=min_price is None,
    )
