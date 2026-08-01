"""Client celebrations - group multi-vendor bookings under one event."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.db import one_row
from app.core.logging import get_logger

logger = get_logger(__name__)

_ACTIVE_BOOKING_STATUSES = frozenset({"pending", "accepted"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_date_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()[:10]


def booking_counts_by_event(client_user_id: str, event_ids: list[str]) -> dict[str, tuple[int, int]]:
    if not event_ids or get_settings().local_auth_mode:
        return {}
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("event_id,status")
            .eq("client_user_id", client_user_id)
            .in_("event_id", event_ids)
            .execute()
        )
    except Exception as e:
        logger.warning("booking_counts_by_event failed client=%s: %s", client_user_id, e)
        return {}
    out: dict[str, tuple[int, int]] = {}
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        eid = str(row.get("event_id") or "")
        if not eid:
            continue
        total, active = out.get(eid, (0, 0))
        total += 1
        if str(row.get("status") or "") in _ACTIVE_BOOKING_STATUSES:
            active += 1
        out[eid] = (total, active)
    return out


def event_row_to_summary(row: dict[str, Any], counts: dict[str, tuple[int, int]]) -> dict[str, Any]:
    eid = str(row.get("id") or "")
    total, active = counts.get(eid, (0, 0))
    end = _normalize_date_str(row.get("event_end_date"))
    return {
        "id": eid,
        "title": str(row.get("title") or ""),
        "event_date": _normalize_date_str(row.get("event_date")),
        "event_end_date": end or None,
        "event_address": str(row.get("event_address") or "") or None,
        "event_postcode": str(row.get("event_postcode") or "") or None,
        "status": str(row.get("status") or "active"),
        "booking_count": total,
        "active_booking_count": active,
        "updated_at": row.get("updated_at"),
    }


def create_client_event(
    client_user_id: str,
    *,
    title: str,
    event_date: date,
    event_end_date: date | None = None,
    event_address: str | None = None,
    event_postcode: str | None = None,
) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        return {
            "id": "00000000-0000-4000-8000-000000000099",
            "title": title.strip(),
            "event_date": event_date.isoformat(),
            "event_end_date": event_end_date.isoformat() if event_end_date else None,
            "event_address": event_address,
            "event_postcode": event_postcode,
            "status": "active",
        }
    row = {
        "client_user_id": client_user_id,
        "title": title.strip(),
        "event_date": event_date.isoformat(),
        "event_end_date": event_end_date.isoformat() if event_end_date else None,
        "event_address": (event_address.strip() if event_address else None),
        "event_postcode": (event_postcode.strip() if event_postcode else None),
        "status": "active",
    }
    res = get_client().table("client_events").insert(row).execute()
    created = one_row(res)
    if created is None:
        raise RuntimeError("Failed to create client event")
    return created


def get_client_event_row(client_user_id: str, event_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    try:
        res = (
            get_client()
            .table("client_events")
            .select("*")
            .eq("id", event_id)
            .eq("client_user_id", client_user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "client_events" in msg or "pgrst205" in msg:
            logger.error("client_events table missing - run backend/sql/057_client_events.sql")
        else:
            logger.warning("get_client_event_row failed event=%s: %s", event_id, e)
        return None
    row = one_row(res)
    return row if isinstance(row, dict) else None


def list_client_events(
    client_user_id: str,
    *,
    status: str = "active",
) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    st = (status or "active").strip().lower()
    if st not in ("active", "archived", "all"):
        raise ValueError("status must be active, archived, or all.")
    try:
        q = (
            get_client()
            .table("client_events")
            .select("*")
            .eq("client_user_id", client_user_id)
            .order("updated_at", desc=True)
        )
        if st != "all":
            q = q.eq("status", st)
        res = q.execute()
    except Exception as e:
        msg = str(e).lower()
        if "client_events" in msg or "pgrst205" in msg:
            logger.warning("list_client_events: table missing")
            return []
        logger.warning("list_client_events failed: %s", e)
        return []
    event_rows = [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    event_ids = [str(r.get("id") or "") for r in event_rows if r.get("id")]
    counts = booking_counts_by_event(client_user_id, event_ids)
    return [event_row_to_summary(r, counts) for r in event_rows]


def resolve_event_for_booking(
    client_user_id: str,
    *,
    event_id: str | None,
    event_name: str,
    event_date: date,
    event_end_date: date | None = None,
    event_address: str | None = None,
    event_postcode: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Return (event_id, booking row fields including event_id and denormalized event columns)."""
    if event_id and event_id.strip():
        existing = get_client_event_row(client_user_id, event_id.strip())
        if existing is None:
            raise ValueError("Event not found.")
        if str(existing.get("status") or "") == "archived":
            raise ValueError("That event is archived. Start a new event or choose another.")
        end = _normalize_date_str(existing.get("event_end_date"))
        return (
            str(existing["id"]),
            {
                "event_id": str(existing["id"]),
                "event_name": str(existing.get("title") or event_name).strip(),
                "event_date": _normalize_date_str(existing.get("event_date")) or event_date.isoformat(),
                "event_end_date": end or (event_end_date.isoformat() if event_end_date else None),
                "event_postcode": existing.get("event_postcode") or event_postcode,
                "event_address": existing.get("event_address") or event_address,
            },
        )

    created = create_client_event(
        client_user_id,
        title=event_name,
        event_date=event_date,
        event_end_date=event_end_date,
        event_address=event_address,
        event_postcode=event_postcode,
    )
    eid = str(created.get("id") or "")
    if not eid:
        raise RuntimeError("Failed to create client event")
    return (
        eid,
        {
            "event_id": eid,
            "event_name": event_name.strip(),
            "event_date": event_date.isoformat(),
            "event_end_date": event_end_date.isoformat() if event_end_date else None,
            "event_postcode": event_postcode.strip() if event_postcode else None,
            "event_address": (event_address.strip() if event_address else None),
        },
    )


def touch_client_event_updated_at(event_id: str) -> None:
    if get_settings().local_auth_mode or not event_id:
        return
    try:
        get_client().table("client_events").update(
            {"updated_at": _now_iso()},
        ).eq("id", event_id).execute()
    except Exception:
        pass
