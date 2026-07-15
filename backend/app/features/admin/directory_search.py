"""Admin directory user search (clients + vendors) for compose / pickers."""

from __future__ import annotations

from typing import Any, Literal

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.auth.lookup import vendor_display_names_by_id

logger = get_logger(__name__)

DirectoryKind = Literal["client", "vendor"]


def search_directory_users_for_admin(
    *,
    q: str,
    kinds: list[DirectoryKind] | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search client and/or vendor accounts by email as the user types."""
    term = (q or "").strip()
    if len(term) < 1:
        return []
    lim = max(1, min(limit, 50))
    want = set(kinds or ["client", "vendor"])
    if get_settings().local_auth_mode:
        return []

    client = get_client()
    out: list[dict[str, Any]] = []
    pattern = f"%{term}%"
    per_kind = max(lim, 1)

    if "client" in want:
        try:
            res = (
                client.table("users")
                .select("id,email")
                .eq("user_type", "client")
                .ilike("email", pattern)
                .limit(per_kind)
                .execute()
            )
            for row in getattr(res, "data", None) or []:
                if not isinstance(row, dict) or not row.get("id"):
                    continue
                email = str(row.get("email") or "")
                out.append(
                    {
                        "user_id": str(row["id"]),
                        "label": email or str(row["id"]),
                        "kind": "client",
                        "email": email or None,
                    },
                )
        except Exception as e:
            logger.warning("search_directory clients failed: %s", e, exc_info=True)

    if "vendor" in want:
        try:
            matched_ids: list[str] = []
            res = (
                client.table("users")
                .select("id,email")
                .eq("user_type", "vendor")
                .ilike("email", pattern)
                .limit(per_kind)
                .execute()
            )
            email_rows = {
                str(r["id"]): r
                for r in (getattr(res, "data", None) or [])
                if isinstance(r, dict) and r.get("id")
            }
            matched_ids.extend(email_rows.keys())

            if len(matched_ids) < per_kind:
                try:
                    vres = (
                        client.table("vendors")
                        .select("user_id")
                        .ilike("business_name_normalized", pattern)
                        .limit(per_kind)
                        .execute()
                    )
                    for row in getattr(vres, "data", None) or []:
                        if isinstance(row, dict) and row.get("user_id"):
                            uid = str(row["user_id"])
                            if uid not in email_rows:
                                matched_ids.append(uid)
                except Exception as e:
                    logger.warning("search_directory vendor business_name failed: %s", e, exc_info=True)

            matched_ids = matched_ids[:per_kind]
            missing_email = [uid for uid in matched_ids if uid not in email_rows]
            if missing_email:
                eres = (
                    client.table("users")
                    .select("id,email")
                    .in_("id", missing_email)
                    .execute()
                )
                for row in getattr(eres, "data", None) or []:
                    if isinstance(row, dict) and row.get("id"):
                        email_rows[str(row["id"])] = row

            names = vendor_display_names_by_id(matched_ids) if matched_ids else {}
            for uid in matched_ids:
                row = email_rows.get(uid) or {}
                email = str(row.get("email") or "")
                out.append(
                    {
                        "user_id": uid,
                        "label": names.get(uid) or email or uid,
                        "kind": "vendor",
                        "email": email or None,
                    },
                )
        except Exception as e:
            logger.warning("search_directory vendors failed: %s", e, exc_info=True)

    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in out:
        uid = item["user_id"]
        if uid in seen:
            continue
        seen.add(uid)
        deduped.append(item)
        if len(deduped) >= lim:
            break
    return deduped
