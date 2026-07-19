"""Persistence for celebration_plans / celebration_plan_items."""

from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import apply_recent_first_order, get_db, one_row, rows
from app.core.logging import get_logger

logger = get_logger(__name__)

# In-memory store for LOCAL_AUTH_MODE (and migration-not-applied soft fallback).
_LOCAL_PLANS: dict[str, dict[str, Any]] = {}
_LOCAL_ITEMS: dict[str, list[dict[str, Any]]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _missing_table(err: Exception) -> bool:
    msg = str(err).lower()
    return "42p01" in msg or "celebration_plan" in msg


def clear_local_store() -> None:
    """Test helper."""
    _LOCAL_PLANS.clear()
    _LOCAL_ITEMS.clear()


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

    if get_settings().local_auth_mode:
        _LOCAL_PLANS[plan_id] = copy.deepcopy(plan_row)
        item_rows = []
        for i, item in enumerate(items):
            item_row = {
                "id": str(uuid.uuid4()),
                "plan_id": plan_id,
                **item,
                "sort_order": item.get("sort_order", i),
            }
            item_rows.append(item_row)
        _LOCAL_ITEMS[plan_id] = item_rows
        out = copy.deepcopy(plan_row)
        out["items"] = copy.deepcopy(item_rows)
        return out

    try:
        res = get_db().table("celebration_plans").insert(plan_row).execute()
        saved = one_row(res) or plan_row
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
            item_rows.append(one_row(ires) or payload)
        saved["items"] = item_rows
        return saved
    except Exception as e:
        if _missing_table(e):
            logger.warning("insert_plan: celebration_plans missing — using memory store (%s)", e)
            _LOCAL_PLANS[plan_id] = copy.deepcopy(plan_row)
            item_rows = []
            for i, item in enumerate(items):
                item_rows.append(
                    {
                        "id": str(uuid.uuid4()),
                        "plan_id": plan_id,
                        **item,
                        "sort_order": item.get("sort_order", i),
                    },
                )
            _LOCAL_ITEMS[plan_id] = item_rows
            out = copy.deepcopy(plan_row)
            out["items"] = copy.deepcopy(item_rows)
            return out
        logger.exception("insert_plan failed")
        raise


def list_plans_for_client(client_user_id: str) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        plans = [p for p in _LOCAL_PLANS.values() if p.get("client_user_id") == client_user_id]
        plans.sort(key=lambda p: str(p.get("updated_at") or ""), reverse=True)
        return copy.deepcopy(plans)

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
        return rows(res)
    except Exception as e:
        if _missing_table(e):
            plans = [p for p in _LOCAL_PLANS.values() if p.get("client_user_id") == client_user_id]
            plans.sort(key=lambda p: str(p.get("updated_at") or ""), reverse=True)
            return copy.deepcopy(plans)
        logger.warning("list_plans_for_client failed: %s", e, exc_info=True)
        return []


def get_plan_for_client(plan_id: str, client_user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        plan = _LOCAL_PLANS.get(plan_id)
        if not plan or plan.get("client_user_id") != client_user_id:
            return None
        out = copy.deepcopy(plan)
        out["items"] = copy.deepcopy(_LOCAL_ITEMS.get(plan_id) or [])
        return out

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
        plan = one_row(res)
        if not plan:
            # IDOR: do not reveal existence — also check memory fallback
            mem = _LOCAL_PLANS.get(plan_id)
            if mem and mem.get("client_user_id") == client_user_id:
                out = copy.deepcopy(mem)
                out["items"] = copy.deepcopy(_LOCAL_ITEMS.get(plan_id) or [])
                return out
            return None
        ires = (
            get_db()
            .table("celebration_plan_items")
            .select("*")
            .eq("plan_id", plan_id)
            .order("sort_order")
            .execute()
        )
        plan["items"] = rows(ires)
        return plan
    except Exception as e:
        if _missing_table(e):
            plan = _LOCAL_PLANS.get(plan_id)
            if not plan or plan.get("client_user_id") != client_user_id:
                return None
            out = copy.deepcopy(plan)
            out["items"] = copy.deepcopy(_LOCAL_ITEMS.get(plan_id) or [])
            return out
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

    if get_settings().local_auth_mode or plan_id in _LOCAL_ITEMS:
        items = _LOCAL_ITEMS.get(plan_id) or []
        for item in items:
            if item.get("need_id") == need_id:
                item.update(patch)
                break
        _LOCAL_ITEMS[plan_id] = items
        if plan_id in _LOCAL_PLANS:
            if plan_patch:
                _LOCAL_PLANS[plan_id].update(plan_patch)
            _LOCAL_PLANS[plan_id]["updated_at"] = _now_iso()
        return get_plan_for_client(plan_id, client_user_id)

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

    if get_settings().local_auth_mode or plan_id in _LOCAL_PLANS:
        if plan_id in _LOCAL_PLANS and _LOCAL_PLANS[plan_id].get("client_user_id") == client_user_id:
            _LOCAL_PLANS[plan_id]["status"] = "archived"
            _LOCAL_PLANS[plan_id]["updated_at"] = _now_iso()
            return copy.deepcopy(_LOCAL_PLANS[plan_id])
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
        return one_row(res)
    except Exception as e:
        logger.warning("archive_plan failed: %s", e, exc_info=True)
        return None
