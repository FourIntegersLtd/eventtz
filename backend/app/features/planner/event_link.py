"""Link celebration plans to client_events for prefill before first booking."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db, one_row
from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.features.client_events import events as client_events_ops
from app.features.planner import db as planner_db

logger = get_logger(__name__)

_LOCAL_PLAN_EVENT: dict[str, str] = {}


def _parse_event_date(brief: dict[str, Any], title_fallback: str) -> date:
    if brief.get("preferred_date_invalid"):
        return date.today()
    raw = str(brief.get("preferred_date") or "").strip()[:10]
    if raw:
        try:
            return date.fromisoformat(raw)
        except ValueError:
            pass
    return date.today()


def _plan_event_fields(row: dict[str, Any]) -> tuple[str, date, str | None, str | None]:
    brief = row.get("brief") if isinstance(row.get("brief"), dict) else {}
    title = str(row.get("title") or "").strip() or "My celebration"
    event_date = _parse_event_date(brief, title)
    location = str(brief.get("location") or "").strip() or None
    return title, event_date, location, None


def ensure_client_event_for_plan(client_user_id: str, plan_id: str) -> dict[str, Any]:
    """Create or return the client_events row linked to this celebration plan."""
    row = planner_db.get_plan_for_client(plan_id, client_user_id)
    if not row:
        raise NotFoundError("Plan not found.")
    if str(row.get("status") or "") == "archived":
        raise ValueError("That plan is archived.")

    existing_id = str(row.get("client_event_id") or "").strip()
    if get_settings().local_auth_mode and not existing_id:
        existing_id = _LOCAL_PLAN_EVENT.get(plan_id, "")
    if existing_id:
        event_row = client_events_ops.get_client_event_row(client_user_id, existing_id)
        if event_row and str(event_row.get("status") or "") == "active":
            return client_events_ops.event_row_to_summary(
                event_row,
                client_events_ops.booking_counts_by_event(client_user_id, [existing_id]),
            )

    title, event_date, location, _postcode = _plan_event_fields(row)
    created = client_events_ops.create_client_event(
        client_user_id,
        title=title,
        event_date=event_date,
        event_address=location,
        event_postcode=None,
    )
    event_id = str(created.get("id") or "")
    if not event_id:
        raise RuntimeError("Failed to create client event for plan.")

    if get_settings().local_auth_mode:
        if plan_id in planner_db._LOCAL_PLANS:
            planner_db._LOCAL_PLANS[plan_id]["client_event_id"] = event_id
        _LOCAL_PLAN_EVENT[plan_id] = event_id
    else:
        try:
            get_db().table("celebration_plans").update(
                {"client_event_id": event_id, "updated_at": datetime.now(timezone.utc).isoformat()},
            ).eq("id", plan_id).eq("client_user_id", client_user_id).execute()
        except Exception as e:
            logger.warning("ensure_client_event_for_plan: could not link plan=%s: %s", plan_id, e)

    counts = client_events_ops.booking_counts_by_event(client_user_id, [event_id])
    return client_events_ops.event_row_to_summary(created, counts)
