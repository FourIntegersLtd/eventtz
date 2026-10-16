"""Other vendors to suggest to a client whose chosen vendor has gone quiet."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import LanguageModel
from app.features.marketplace import service_explore, service_search
from app.features.marketplace.domain_alternatives import (
    ALTERNATIVES_LIMIT,
    ALTERNATIVES_SEARCH_LIMIT,
    search_params_for_alternatives,
    usual_reply_label,
    vendor_display_name,
)

log = get_logger(__name__)


@dataclass(frozen=True)
class AlternativeVendor:
    """A listed vendor to suggest: who they are and how fast they usually reply."""

    user_id: str
    name: str
    reply: str


async def alternative_vendors(
    session: AsyncSession,
    *,
    search_context: dict[str, object] | None,
    silent_vendor_payload: dict[str, object] | None,
    exclude_vendor_ids: set[str],
    language_model: LanguageModel,
    limit: int = ALTERNATIVES_LIMIT,
) -> list[AlternativeVendor]:
    """Up to `limit` listed vendors from a search like the client's, skipping `exclude_vendor_ids`.

    Only vendors the public listing shows are returned (the same search the browse page
    runs). A search that fails gives no alternatives rather than an error: the nudge is
    still worth sending without them.
    """
    params = search_params_for_alternatives(search_context, silent_vendor_payload)
    try:
        result = await service_search.search_vendors(
            session,
            None,
            service_search.SearchRequest(
                types=params["types"],
                location=params["location"],
                search=params["search"],
                dates=params["dates"],
                country=params["country"],
                limit=ALTERNATIVES_SEARCH_LIMIT,
            ),
            language_model=language_model,
        )
    except Exception:
        log.exception("marketplace: alternative vendor search failed")
        return []
    candidates = [row for row in result.vendors if str(row.get("user_id") or "") not in exclude_vendor_ids]
    candidates = candidates[:limit]
    if not candidates:
        return []
    signals = await service_explore.signals_for(session, [str(row["user_id"]) for row in candidates])
    alternatives: list[AlternativeVendor] = []
    for row in candidates:
        user_id = str(row["user_id"])
        payload = row.get("payload")
        found = signals.get(user_id)
        alternatives.append(
            AlternativeVendor(
                user_id=user_id,
                name=vendor_display_name(payload if isinstance(payload, dict) else {}),
                reply=usual_reply_label(found.avg_response_seconds if found else None),
            )
        )
    return alternatives
