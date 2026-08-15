"""Persistence for celebration_plans / celebration_plan_items."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.db import apply_recent_first_order, get_db, first_row_from_query_result, rows_from_query_result
from app.core.logging import get_logger

logger = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def insert_plan(
    *,
    client_user_id: str,
    title: str,
    raw_prompt: str,
    brief: dict[str, Any],
    confidence_score: int | None,
    confidence_reasons: list[str],
    summary: str | None,
    budget_total_gbp: float | None,
    budget_remaining_gbp: float | None,
    currency: str = "GBP",
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Insert plan + items. Returns plan row with ``items`` attached."""
    plan_id = str(uuid.uuid4())
    now = _now_iso()
    plan_row: dict[str, Any] = {
        "id": plan_id,
        "client_user_id": client_user_id,
        "title": title,
        "raw_prompt": raw_prompt,
        "brief": brief,
        "confidence_score": confidence_score,
        "confidence_reasons": confidence_reasons,
        "summary": summary,
        "budget_total_gbp": budget_total_gbp,
        "budget_remaining_gbp": budget_remaining_gbp,
        "currency": currency or "GBP",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    res = get_db().table("celebration_plans").insert(plan_row).execute()
    saved = first_row_from_query_result(res) or plan_row
    plan_id = str(saved.get("id") or plan_id)
    item_rows: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        payload = {
            "plan_id": plan_id,
            "need_id": item["need_id"],
            "label": item.get("label") or "",
            "service_key": item["service_key"],
            "optional": bool(item.get("optional")),
            "primary_vendor_user_id": item.get("primary_vendor_user_id"),
            "alternative_vendor_user_ids": item.get("alternative_vendor_user_ids") or [],
            "estimated_cost_gbp": item.get("estimated_cost_gbp"),
            "why_selected": item.get("why_selected"),
            "score_breakdown": item.get("score_breakdown"),
            "sort_order": int(item.get("sort_order") if item.get("sort_order") is not None else i),
        }
        ires = get_db().table("celebration_plan_items").insert(payload).execute()
        item_rows.append(first_row_from_query_result(ires) or payload)
    saved["items"] = item_rows
    return saved


def list_plans_for_client(client_user_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            apply_recent_first_order(
                get_db()
                .table("celebration_plans")
                .select(
                    "id,client_user_id,title,brief,confidence_score,status,created_at,updated_at",
                )
                .eq("client_user_id", client_user_id)
                .neq("status", "archived"),
            )
            .execute()
        )
        return rows_from_query_result(res)
    except Exception as e:
        logger.warning("list_plans_for_client failed: %s", e, exc_info=True)
        return []


def get_plan_for_client(plan_id: str, client_user_id: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
            .table("celebration_plans")
            .select("*")
            .eq("id", plan_id)
            .eq("client_user_id", client_user_id)
            .limit(1)
            .execute()
        )
        plan = first_row_from_query_result(res)
        if not plan:
            return None
        ires = (
            get_db()
            .table("celebration_plan_items")
            .select("*")
            .eq("plan_id", plan_id)
            .order("sort_order")
            .execute()
        )
        plan["items"] = rows_from_query_result(ires)
        return plan
    except Exception as e:
        logger.warning("get_plan_for_client failed: %s", e, exc_info=True)
        return None


def update_plan_item(
    *,
    plan_id: str,
    client_user_id: str,
    need_id: str,
    patch: dict[str, Any],
    plan_patch: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    plan = get_plan_for_client(plan_id, client_user_id)
    if not plan:
        return None

    try:
        get_db().table("celebration_plan_items").update(patch).eq("plan_id", plan_id).eq(
            "need_id",
            need_id,
        ).execute()
        plan_update = {"updated_at": _now_iso()}
        if plan_patch:
            plan_update.update(plan_patch)
        get_db().table("celebration_plans").update(plan_update).eq("id", plan_id).eq(
            "client_user_id",
            client_user_id,
        ).execute()
        return get_plan_for_client(plan_id, client_user_id)
    except Exception as e:
        logger.warning("update_plan_item failed: %s", e, exc_info=True)
        return None


def archive_plan(plan_id: str, client_user_id: str) -> dict[str, Any] | None:
    plan = get_plan_for_client(plan_id, client_user_id)
    if not plan:
        return None

    try:
        res = (
            get_db()
            .table("celebration_plans")
            .update({"status": "archived", "updated_at": _now_iso()})
            .eq("id", plan_id)
            .eq("client_user_id", client_user_id)
            .execute()
        )
        return first_row_from_query_result(res)
    except Exception as e:
        logger.warning("archive_plan failed: %s", e, exc_info=True)
        return None
