"""The caller's IP address, for per-IP rate limits.

Behind the hosting proxy the real address is the first entry of `X-Forwarded-For`; locally it is
the socket peer. The header can be forged by a direct caller, so use it only to slow abuse down,
never to grant access.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request


def client_ip(request: Request) -> str | None:
    """The first `X-Forwarded-For` address, else the connecting peer, else `None`."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.client.host if request.client else None


# What routers declare as a parameter type: `def sign_in(body: ..., caller_ip: ClientIp)`.
ClientIp = Annotated[str | None, Depends(client_ip)]
