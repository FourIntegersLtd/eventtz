"""Database access for planner plans and client events. The only file in `planner` that queries.

Every function takes the request's session and never commits (ADR 0002).

`booking_requests` is owned by the `bookings` slice; this file reads it through a
bare `table()`/`column()` declaration (the precedented cross-slice-read pattern
in, for example, `vendors/repository.py`), never through `bookings.models`.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import Uuid, column, func, insert, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.planner.models import CelebrationPlan, CelebrationPlanItem, ClientEvent
from app.features.planner.rows import CelebrationPlanItemRow, CelebrationPlanRow, ClientEventRow

# A bare handle onto `bookings`' table: only the columns this slice needs to count
# a client event's bookings, never the ORM model that slice owns.
_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("client_user_id", Uuid),
    column("event_id", Uuid),
    column("status"),
)

_EVENT_COLUMNS = (
    ClientEvent.id,
    ClientEvent.client_user_id,
    ClientEvent.title,
    ClientEvent.event_date,
    ClientEvent.event_end_date,
    ClientEvent.event_address,
    ClientEvent.event_postcode,
    ClientEvent.status,
    ClientEvent.created_at,
    ClientEvent.updated_at,
)


async def get_client_event(
    session: AsyncSession, client_user_id: str, event_id: str
) -> ClientEventRow | None:
    """The client's own event with this id, or `None` (also for a malformed id)."""
    event_uuid = as_uuid(event_id)
    client_uuid = as_uuid(client_user_id)
    if event_uuid is None or client_uuid is None:
        return None
    result = await session.execute(
        select(*_EVENT_COLUMNS)
        .where(ClientEvent.id == event_uuid, ClientEvent.client_user_id == client_uuid)
        .limit(1)
    )
    found = result.first()
    return ClientEventRow.model_validate(plain_row(found)) if found is not None else None


async def insert_client_event(
    session: AsyncSession,
    *,
    client_user_id: str,
    title: str,
    event_date: date,
    event_end_date: date | None,
    event_address: str | None,
    event_postcode: str | None,
) -> ClientEventRow:
    """Store a new active event and return it."""
    result = await session.execute(
        insert(ClientEvent)
        .values(
            client_user_id=as_uuid(client_user_id),
            title=title,
            event_date=event_date,
            event_end_date=event_end_date,
            event_address=event_address,
            event_postcode=event_postcode,
            status="active",
        )
        .returning(*_EVENT_COLUMNS)
    )
    return ClientEventRow.model_validate(plain_row(result.one()))


async def touch_event(session: AsyncSession, event_id: str) -> None:
    """Move the event's `updated_at` to now, so it sorts as recently active."""
    event_uuid = as_uuid(event_id)
    if event_uuid is None:
        return
    await session.execute(
        update(ClientEvent).where(ClientEvent.id == event_uuid).values(updated_at=func.now())
    )


async def event_titles(session: AsyncSession, event_ids: list[str]) -> dict[str, str]:
    """Map each event id to its title; unknown ids are left out."""
    event_uuids = [event_uuid for event_uuid in (as_uuid(event_id) for event_id in event_ids) if event_uuid]
    if not event_uuids:
        return {}
    result = await session.execute(
        select(ClientEvent.id, ClientEvent.title).where(ClientEvent.id.in_(event_uuids))
    )
    return {str(event_uuid): title or "" for event_uuid, title in result}


# The two booking-request states that count as "still live" for a client event's card.
_ACTIVE_BOOKING_STATUSES = frozenset({"pending", "accepted"})


async def list_client_events(
    session: AsyncSession, client_user_id: str, *, status_filter: str
) -> list[ClientEventRow]:
    """The client's own events, newest event date first; `status_filter` is 'active', 'archived' or 'all'."""
    client_uuid = as_uuid(client_user_id)
    if client_uuid is None:
        return []
    query = select(*_EVENT_COLUMNS).where(ClientEvent.client_user_id == client_uuid)
    if status_filter != "all":
        query = query.where(ClientEvent.status == status_filter)
    result = await session.execute(query.order_by(ClientEvent.event_date.desc()))
    return [ClientEventRow.model_validate(plain_row(row)) for row in result]


async def booking_counts_by_event(
    session: AsyncSession, client_user_id: str, event_ids: list[str]
) -> dict[str, tuple[int, int]]:
    """Map each event id to `(booking_count, active_booking_count)` for the caller's own bookings."""
    client_uuid = as_uuid(client_user_id)
    event_uuids = [event_uuid for event_uuid in (as_uuid(event_id) for event_id in event_ids) if event_uuid]
    if client_uuid is None or not event_uuids:
        return {}
    result = await session.execute(
        select(_booking_requests.c.event_id, _booking_requests.c.status).where(
            _booking_requests.c.client_user_id == client_uuid,
            _booking_requests.c.event_id.in_(event_uuids),
        )
    )
    counts: dict[str, list[int]] = {}
    for event_id, status in result:
        bucket = counts.setdefault(str(event_id), [0, 0])
        bucket[0] += 1
        if status in _ACTIVE_BOOKING_STATUSES:
            bucket[1] += 1
    return {event_id: (total, active) for event_id, (total, active) in counts.items()}


# --- celebration plans -------------------------------------------------------------------------

_PLAN_COLUMNS = (
    CelebrationPlan.id,
    CelebrationPlan.client_user_id,
    CelebrationPlan.title,
    CelebrationPlan.raw_prompt,
    CelebrationPlan.brief,
    CelebrationPlan.confidence_score,
    CelebrationPlan.confidence_reasons,
    CelebrationPlan.summary,
    CelebrationPlan.budget_total_gbp,
    CelebrationPlan.budget_remaining_gbp,
    CelebrationPlan.currency,
    CelebrationPlan.status,
    CelebrationPlan.client_event_id,
    CelebrationPlan.created_at,
    CelebrationPlan.updated_at,
)

_ITEM_COLUMNS = (
    CelebrationPlanItem.id,
    CelebrationPlanItem.plan_id,
    CelebrationPlanItem.need_id,
    CelebrationPlanItem.label,
    CelebrationPlanItem.service_key,
    CelebrationPlanItem.optional,
    CelebrationPlanItem.primary_vendor_user_id,
    CelebrationPlanItem.alternative_vendor_user_ids,
    CelebrationPlanItem.estimated_cost_gbp,
    CelebrationPlanItem.why_selected,
    CelebrationPlanItem.score_breakdown,
    CelebrationPlanItem.sort_order,
)


def _item_row(row: Any) -> CelebrationPlanItemRow:
    """One item result row, with its alternative-vendor uuids made plain text."""
    plain = plain_row(row)
    plain["alternative_vendor_user_ids"] = [
        str(vendor_uuid) for vendor_uuid in (plain.get("alternative_vendor_user_ids") or [])
    ]
    return CelebrationPlanItemRow.model_validate(plain)


async def insert_plan(
    session: AsyncSession,
    *,
    client_user_id: str,
    title: str,
    raw_prompt: str,
    brief: dict[str, Any],
    confidence_score: int | None,
    confidence_reasons: list[str] | None,
    summary: str | None,
    budget_total_gbp: float | None,
    budget_remaining_gbp: float | None,
    currency: str = "GBP",
) -> CelebrationPlanRow:
    """Store a new active plan (its items are inserted separately) and return it."""
    result = await session.execute(
        insert(CelebrationPlan)
        .values(
            client_user_id=as_uuid(client_user_id),
            title=title,
            raw_prompt=raw_prompt,
            brief=brief,
            confidence_score=confidence_score,
            confidence_reasons=confidence_reasons,
            summary=summary,
            budget_total_gbp=budget_total_gbp,
            budget_remaining_gbp=budget_remaining_gbp,
            currency=currency,
            status="active",
        )
        .returning(*_PLAN_COLUMNS)
    )
    return CelebrationPlanRow.model_validate(plain_row(result.one()))


async def insert_plan_items(
    session: AsyncSession, plan_id: str, items: list[dict[str, Any]]
) -> list[CelebrationPlanItemRow]:
    """Store the plan's recommended needs, in the order given, and return them."""
    if not items:
        return []
    plan_uuid = as_uuid(plan_id)
    values = [
        {
            "plan_id": plan_uuid,
            "need_id": item["need_id"],
            "label": item["label"],
            "service_key": item["service_key"],
            "optional": item.get("optional", False),
            "primary_vendor_user_id": as_uuid(item.get("primary_vendor_user_id")),
            "alternative_vendor_user_ids": [
                vendor_uuid
                for vendor_uuid in (
                    as_uuid(vendor_id) for vendor_id in item.get("alternative_vendor_user_ids", [])
                )
                if vendor_uuid
            ],
            "estimated_cost_gbp": item.get("estimated_cost_gbp"),
            "why_selected": item.get("why_selected"),
            "score_breakdown": item.get("score_breakdown"),
            "sort_order": index,
        }
        for index, item in enumerate(items)
    ]
    result = await session.execute(insert(CelebrationPlanItem).values(values).returning(*_ITEM_COLUMNS))
    return [_item_row(row) for row in result]


async def get_plan(session: AsyncSession, client_user_id: str, plan_id: str) -> CelebrationPlanRow | None:
    """The client's own plan with this id, or `None` (also for a malformed id)."""
    client_uuid = as_uuid(client_user_id)
    plan_uuid = as_uuid(plan_id)
    if client_uuid is None or plan_uuid is None:
        return None
    result = await session.execute(
        select(*_PLAN_COLUMNS)
        .where(CelebrationPlan.id == plan_uuid, CelebrationPlan.client_user_id == client_uuid)
        .limit(1)
    )
    found = result.first()
    return CelebrationPlanRow.model_validate(plain_row(found)) if found is not None else None


async def get_plan_items(session: AsyncSession, plan_id: str) -> list[CelebrationPlanItemRow]:
    """The plan's items, in their stored display order."""
    plan_uuid = as_uuid(plan_id)
    if plan_uuid is None:
        return []
    result = await session.execute(
        select(*_ITEM_COLUMNS)
        .where(CelebrationPlanItem.plan_id == plan_uuid)
        .order_by(CelebrationPlanItem.sort_order)
    )
    return [_item_row(row) for row in result]


async def get_plan_item_by_need(
    session: AsyncSession, plan_id: str, need_id: str
) -> CelebrationPlanItemRow | None:
    """One item of the plan by its `need_id`, or `None`."""
    plan_uuid = as_uuid(plan_id)
    if plan_uuid is None:
        return None
    result = await session.execute(
        select(*_ITEM_COLUMNS)
        .where(CelebrationPlanItem.plan_id == plan_uuid, CelebrationPlanItem.need_id == need_id)
        .limit(1)
    )
    found = result.first()
    return _item_row(found) if found is not None else None


async def list_plans(session: AsyncSession, client_user_id: str) -> list[CelebrationPlanRow]:
    """The client's own non-archived plans, most recently updated first."""
    client_uuid = as_uuid(client_user_id)
    if client_uuid is None:
        return []
    result = await session.execute(
        select(*_PLAN_COLUMNS)
        .where(CelebrationPlan.client_user_id == client_uuid, CelebrationPlan.status != "archived")
        .order_by(CelebrationPlan.updated_at.desc())
    )
    return [CelebrationPlanRow.model_validate(plain_row(row)) for row in result]


async def update_plan_item(
    session: AsyncSession,
    item_id: str,
    *,
    primary_vendor_user_id: str | None,
    alternative_vendor_user_ids: list[str],
    estimated_cost_gbp: float | None,
    why_selected: str | None,
    score_breakdown: dict[str, Any] | None,
) -> CelebrationPlanItemRow:
    """Replace one item's vendor pick (and its cost/why/score) after the client asked for another."""
    result = await session.execute(
        update(CelebrationPlanItem)
        .where(CelebrationPlanItem.id == as_uuid(item_id))
        .values(
            primary_vendor_user_id=as_uuid(primary_vendor_user_id),
            alternative_vendor_user_ids=[
                vendor_uuid
                for vendor_uuid in (as_uuid(vendor_id) for vendor_id in alternative_vendor_user_ids)
                if vendor_uuid
            ],
            estimated_cost_gbp=estimated_cost_gbp,
            why_selected=why_selected,
            score_breakdown=score_breakdown,
        )
        .returning(*_ITEM_COLUMNS)
    )
    return _item_row(result.one())


async def touch_plan(session: AsyncSession, plan_id: str) -> None:
    """Move the plan's `updated_at` to now, so it sorts as recently active."""
    plan_uuid = as_uuid(plan_id)
    if plan_uuid is None:
        return
    await session.execute(
        update(CelebrationPlan).where(CelebrationPlan.id == plan_uuid).values(updated_at=func.now())
    )


async def archive_plan(session: AsyncSession, client_user_id: str, plan_id: str) -> CelebrationPlanRow | None:
    """Flip the client's own plan to 'archived' and return it, or `None` if it is not theirs."""
    client_uuid = as_uuid(client_user_id)
    plan_uuid = as_uuid(plan_id)
    if client_uuid is None or plan_uuid is None:
        return None
    result = await session.execute(
        update(CelebrationPlan)
        .where(CelebrationPlan.id == plan_uuid, CelebrationPlan.client_user_id == client_uuid)
        .values(status="archived")
        .returning(*_PLAN_COLUMNS)
    )
    found = result.first()
    return CelebrationPlanRow.model_validate(plain_row(found)) if found is not None else None


async def link_plan_event(session: AsyncSession, plan_id: str, client_event_id: str) -> None:
    """Point the plan at the client event it was turned into."""
    await session.execute(
        update(CelebrationPlan)
        .where(CelebrationPlan.id == as_uuid(plan_id))
        .values(client_event_id=as_uuid(client_event_id))
    )
