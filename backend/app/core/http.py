"""Request helpers shared by the routers."""

from __future__ import annotations

import ipaddress

from fastapi import Request

from app.core.config import get_settings


def client_ip(request: Request) -> str:
    """The visitor's address, for per-visitor rate limits.

    On Railway every request reaches us through its edge proxy, so the peer is always the
    proxy. The edge overwrites ``X-Real-IP`` and ``X-Forwarded-For`` on every request (a
    caller's own copies are replaced, not appended), so they cannot be forged from outside:
    ``X-Real-IP`` first, then the first ``X-Forwarded-For`` entry. Railway publishes no proxy
    ranges, which is why this keys on ``RAILWAY_ENVIRONMENT`` rather than uvicorn's
    ``--forwarded-allow-ips``. Off Railway the headers are ignored, since anyone could send them.
    """
    peer = request.client.host if request.client else "unknown"
    if not get_settings().railway_environment:
        return peer
    first_forwarded = request.headers.get("x-forwarded-for", "").split(",")[0]
    for candidate in (request.headers.get("x-real-ip", ""), first_forwarded):
        try:
            return str(ipaddress.ip_address(candidate.strip()))
        except ValueError:
            continue
    return peer
