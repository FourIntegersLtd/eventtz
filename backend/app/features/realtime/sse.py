"""In-process SSE broadcaster for live UI refresh signals.

This is intentionally lightweight: we don't stream DB rows to the browser. We only emit
small events (e.g. 'chat_unread_changed') and the frontend refetches via existing
authenticated endpoints.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from typing import DefaultDict


@dataclass(frozen=True)
class RealtimeEvent:
    event: str
    data: dict


_loop: asyncio.AbstractEventLoop | None = None
_queues_by_user: DefaultDict[str, set[asyncio.Queue[RealtimeEvent]]] = defaultdict(set)


def register_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def register_user_queue(user_id: str, q: asyncio.Queue[RealtimeEvent]) -> None:
    _queues_by_user[user_id].add(q)


def unregister_user_queue(user_id: str, q: asyncio.Queue[RealtimeEvent]) -> None:
    qs = _queues_by_user.get(user_id)
    if not qs:
        return
    qs.discard(q)
    if not qs:
        _queues_by_user.pop(user_id, None)


def notify_user(user_id: str, event: str, data: dict | None = None) -> None:
    """Thread-safe emit to all connected SSE clients for a user."""
    qs = _queues_by_user.get(user_id)
    if not qs:
        return
    payload = RealtimeEvent(event=event, data=data or {})
    loop = _loop
    if loop is None:
        # No active SSE loop registered yet; nothing to do.
        return

    for q in list(qs):
        try:
            loop.call_soon_threadsafe(q.put_nowait, payload)
        except Exception:
            # Ignore failing queues; cleanup happens on disconnect.
            continue


def format_sse(event: RealtimeEvent) -> str:
    body = json.dumps(event.data, ensure_ascii=False)
    return f"event: {event.event}\ndata: {body}\n\n"

