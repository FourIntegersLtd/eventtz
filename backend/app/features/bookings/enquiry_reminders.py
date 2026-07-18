"""Timed vendor enquiry reminders and client 24h alternative-vendor nudge."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.email.branding import email_public_base
from app.features.email.dispatch import dispatch_booking_notification
from app.features.email.service import get_email_service
from app.features.vendors.public_metrics import format_usual_reply_seconds
from app.features.vendors.business_name import business_name_from_payload

logger = get_logger(__name__)

_REMINDER_STEPS: tuple[tuple[str, str, int], ...] = (
    ("enquiry_reminder_1h_at", "enquiry_reminder_1h", 1),
    ("enquiry_reminder_6h_at", "enquiry_reminder_6h", 6),
    ("enquiry_reminder_24h_at", "enquiry_reminder_24h", 24),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _eligible_pending_enquiries(limit: int = 200) -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select(
                "id,client_user_id,vendor_user_id,event_name,created_at,"
                "vendor_first_response_at,status,initiator,"
                "enquiry_reminder_1h_at,enquiry_reminder_6h_at,enquiry_reminder_24h_at,"
                "client_no_response_nudge_at,client_search_context",
            )
            .eq("status", "pending")
            .eq("initiator", "client")
            .is_("vendor_first_response_at", "null")
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return [r for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]
    except Exception:
        logger.exception("enquiry_reminders: list pending failed")
        return []


def _stamp(booking_id: str, column: str) -> None:
    try:
        get_client().table("booking_requests").update({column: _now_iso()}).eq(
            "id",
            booking_id,
        ).execute()
    except Exception:
        logger.exception("enquiry_reminders: stamp %s failed booking=%s", column, booking_id)


def _send_vendor_reminder(row: dict[str, Any], *, kind: str, hours: int) -> bool:
    vendor_id = str(row.get("vendor_user_id") or "")
    booking_id = str(row.get("id") or "")
    if not vendor_id or not booking_id:
        return False
    try:
        dispatch_booking_notification(
            user_id=vendor_id,
            booking_id=booking_id,
            kind=kind,  # type: ignore[arg-type]
            mode="insert_if_absent",
            portal="vendor",
            event_name=str(row.get("event_name") or "") or None,
        )
        try:
            from app.features.analytics.events import record_marketplace_event

            record_marketplace_event(
                "enquiry_vendor_reminded",
                vendor_user_id=vendor_id,
                booking_request_id=booking_id,
                payload={"hours": hours, "kind": kind},
            )
        except Exception:
            pass
        return True
    except Exception:
        logger.exception(
            "enquiry_reminders: vendor notify failed booking=%s kind=%s",
            booking_id,
            kind,
        )
        return False


def process_vendor_enquiry_reminders(limit: int = 200) -> int:
    """Send 1h / 6h / 24h vendor nudges for unanswered client enquiries."""
    sent = 0
    now = _now()
    for row in _eligible_pending_enquiries(limit):
        created = _parse_ts(row.get("created_at"))
        if created is None:
            continue
        age = now - created
        booking_id = str(row.get("id") or "")
        for col, kind, hours in _REMINDER_STEPS:
            if row.get(col):
                continue
            if age < timedelta(hours=hours):
                continue
            if _send_vendor_reminder(row, kind=kind, hours=hours):
                _stamp(booking_id, col)
                row[col] = _now_iso()
                sent += 1
    return sent


def _client_already_contacted_vendor_ids(client_user_id: str) -> set[str]:
    if not client_user_id:
        return set()
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("vendor_user_id")
            .eq("client_user_id", client_user_id)
            .limit(500)
            .execute()
        )
        out: set[str] = set()
        for r in getattr(res, "data", None) or []:
            if isinstance(r, dict) and r.get("vendor_user_id"):
                out.add(str(r["vendor_user_id"]))
        return out
    except Exception:
        logger.exception("enquiry_reminders: contacted vendors failed client=%s", client_user_id)
        return set()


def _suggest_alternative_vendors(
    *,
    client_user_id: str,
    exclude_vendor_id: str,
    search_context: dict[str, Any] | None,
    silent_vendor_payload: dict[str, Any] | None,
    limit: int = 5,
) -> list[dict[str, str]]:
    """Return [{name, href, reply}] for email — other vendors from similar search."""
    from app.features.vendors.public_metrics import get_public_metrics_for_vendors
    from app.features.vendors.search import search_approved_vendors

    ctx = search_context if isinstance(search_context, dict) else {}
    types = ctx.get("types")
    if isinstance(types, list):
        types_s = ",".join(str(t) for t in types if t)
    else:
        types_s = None
    if not types_s and isinstance(silent_vendor_payload, dict):
        services = silent_vendor_payload.get("servicesOffered")
        if isinstance(services, list) and services:
            types_s = str(services[0])

    location = str(ctx.get("location") or "").strip() or None
    if not location and isinstance(silent_vendor_payload, dict):
        city = silent_vendor_payload.get("baseCity")
        if isinstance(city, str) and city.strip():
            location = city.strip()

    country = str(ctx.get("country") or "GB").strip() or "GB"
    q = str(ctx.get("q") or "").strip() or None
    dates = ctx.get("dates")
    dates_s = None
    if isinstance(dates, list) and dates:
        dates_s = ",".join(str(d) for d in dates[:3] if d)

    try:
        result = search_approved_vendors(
            types=types_s,
            location=location,
            q=q,
            dates=dates_s,
            country=country,
            limit=40,
            offset=0,
        )
    except Exception:
        logger.exception("enquiry_reminders: alternative search failed")
        return []

    exclude = _client_already_contacted_vendor_ids(client_user_id)
    exclude.add(exclude_vendor_id)
    candidates = [
        r
        for r in result.vendors
        if isinstance(r, dict) and str(r.get("user_id") or "") not in exclude
    ][:limit]
    if not candidates:
        return []

    ids = [str(r["user_id"]) for r in candidates]
    metrics = get_public_metrics_for_vendors(ids)
    base = email_public_base()
    out: list[dict[str, str]] = []
    for r in candidates:
        uid = str(r.get("user_id") or "")
        payload = r.get("payload") if isinstance(r.get("payload"), dict) else {}
        raw_name = payload.get("businessName") if isinstance(payload, dict) else None
        name = (
            str(raw_name).strip()
            if isinstance(raw_name, str) and raw_name.strip()
            else (business_name_from_payload(payload) if payload else None) or "Vendor"
        )
        m = metrics.get(uid) or {}
        reply_bit = format_usual_reply_seconds(m.get("avg_response_seconds"))
        out.append(
            {
                "name": name,
                "href": f"{base}/client/browse/{uid}",
                "reply": f"Usually replies {reply_bit}" if reply_bit else "Reply time varies",
            },
        )
    return out


def process_client_no_response_nudges(limit: int = 100) -> int:
    """At 24h without vendor reply: email client with alternative vendors."""
    if get_settings().local_auth_mode:
        return 0
    sent = 0
    now = _now()
    for row in _eligible_pending_enquiries(limit):
        if row.get("client_no_response_nudge_at"):
            continue
        created = _parse_ts(row.get("created_at"))
        if created is None or now - created < timedelta(hours=24):
            continue
        booking_id = str(row.get("id") or "")
        client_id = str(row.get("client_user_id") or "")
        vendor_id = str(row.get("vendor_user_id") or "")
        if not booking_id or not client_id:
            continue

        payload: dict[str, Any] | None = None
        vendor_name = "the vendor"
        try:
            from app.features.vendors.moderation import get_approved_vendor_payload

            payload = get_approved_vendor_payload(vendor_id)
            if payload:
                raw = payload.get("businessName")
                if isinstance(raw, str) and raw.strip():
                    vendor_name = raw.strip()
                else:
                    vendor_name = business_name_from_payload(payload) or vendor_name
        except Exception:
            pass

        ctx = row.get("client_search_context")
        search_ctx = ctx if isinstance(ctx, dict) else None
        alternatives = _suggest_alternative_vendors(
            client_user_id=client_id,
            exclude_vendor_id=vendor_id,
            search_context=search_ctx,
            silent_vendor_payload=payload,
        )

        try:
            dispatch_booking_notification(
                user_id=client_id,
                booking_id=booking_id,
                kind="client_vendor_no_response",  # type: ignore[arg-type]
                mode="insert_if_absent",
                portal="client",
                event_name=str(row.get("event_name") or "") or None,
            )
        except Exception:
            logger.exception(
                "enquiry_reminders: client in-app nudge failed booking=%s",
                booking_id,
            )

        try:
            from app.features.auth.lookup import user_emails_by_id

            emails = user_emails_by_id([client_id])
            to_email = emails.get(client_id, "").strip()
            if to_email and "@" in to_email:
                get_email_service().send_client_vendor_no_response(
                    to_email=to_email,
                    recipient_user_id=client_id,
                    booking_id=booking_id,
                    vendor_name=vendor_name,
                    event_name=str(row.get("event_name") or "").strip() or "your event",
                    alternatives=alternatives,
                    browse_url=f"{email_public_base()}/client/browse",
                    booking_url=f"{email_public_base()}/client/bookings/{booking_id}",
                )
        except Exception:
            logger.exception(
                "enquiry_reminders: client email nudge failed booking=%s",
                booking_id,
            )

        _stamp(booking_id, "client_no_response_nudge_at")
        try:
            from app.features.analytics.events import record_marketplace_event

            record_marketplace_event(
                "enquiry_client_no_response_nudge",
                actor_user_id=client_id,
                vendor_user_id=vendor_id,
                booking_request_id=booking_id,
                payload={"alternatives": len(alternatives)},
            )
        except Exception:
            pass
        sent += 1
    return sent


def process_enquiry_response_maintenance(limit: int = 200) -> dict[str, int]:
    vendor_sent = process_vendor_enquiry_reminders(limit=limit)
    client_sent = process_client_no_response_nudges(limit=limit)
    return {"vendor_reminders": vendor_sent, "client_nudges": client_sent}
