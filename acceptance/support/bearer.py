"""The browser's session for `TARGET=api`: Bearer tokens instead of cookies.

The baseline keeps the session in `eventtz_access_token`/`eventtz_refresh_token`
cookies that it sets and clears itself. api/ sets no cookies (ADR 0003): the web
app holds the access token and sends it as `Authorization: Bearer`, and its own
`/api/session` routes keep the refresh token and put it in the body of
`/auth/refresh` and `/auth/signout`.

`BearerSession` plays that web app, following the baseline's cookie rules so
every freeze test reads the same on both targets:

- a response carrying a `session` stores its tokens (sign-in, refresh, reset, verify)
- sign-out, any 401, and a successful password change or account deletion drop them
- a failed sign-in, refresh or sign-up drops them
- an empty refresh or sign-out body gets the stored refresh token
"""

from __future__ import annotations

import json
from collections.abc import Generator

import httpx

API = "/api/v1"
SIGN_IN = f"{API}/auth/signin"
SIGN_UP = f"{API}/auth/signup"
SIGN_OUT = f"{API}/auth/signout"
REFRESH = f"{API}/auth/refresh"
CHANGE_PASSWORD = f"{API}/auth/change-password"
ACCOUNT_DELETION = f"{API}/user/account/deletion"
# Routes whose request body carries the refresh token when the caller leaves it out.
SENDS_REFRESH_TOKEN = {SIGN_OUT, REFRESH}
# Routes after whose success the baseline clears the session cookies.
ENDS_SESSION_ON_SUCCESS = {CHANGE_PASSWORD, ACCOUNT_DELETION}
# Routes after whose failure the baseline clears the session cookies.
ENDS_SESSION_ON_FAILURE = {SIGN_IN, SIGN_UP, REFRESH}


class BearerSession(httpx.Auth):
    """An httpx auth flow holding one browser's access and refresh tokens."""

    requires_response_body = True

    def __init__(self) -> None:
        """Start signed out."""
        self.access_token: str | None = None
        self.refresh_token: str | None = None

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response]:
        """Present the tokens on the way out; update them from the response on the way back."""
        path = request.url.path
        if path in SENDS_REFRESH_TOKEN and self.refresh_token and _body_lacks_refresh_token(request):
            request = _with_json_body(request, {"refresh_token": self.refresh_token})
        if self.access_token and "authorization" not in request.headers:
            request.headers["Authorization"] = f"Bearer {self.access_token}"
        response = yield request
        self._follow(path, response)

    def _follow(self, path: str, response: httpx.Response) -> None:
        """Keep, replace or drop the tokens as the baseline would have set or cleared its cookies."""
        succeeded = response.is_success
        issued = _issued_session(response)
        if issued is not None:
            self.access_token, self.refresh_token = issued
        elif (
            path == SIGN_OUT
            or response.status_code == httpx.codes.UNAUTHORIZED
            or (succeeded and path in ENDS_SESSION_ON_SUCCESS)
            or (not succeeded and path in ENDS_SESSION_ON_FAILURE)
        ):
            self.access_token = self.refresh_token = None


def _body_lacks_refresh_token(request: httpx.Request) -> bool:
    """True when the request sends no `refresh_token` of its own (empty body or `{}`)."""
    if not request.content:
        return True
    try:
        body = json.loads(request.content)
    except ValueError:
        return False
    return isinstance(body, dict) and not body.get("refresh_token")


def _with_json_body(request: httpx.Request, body: dict[str, str]) -> httpx.Request:
    """A copy of `request` with `body` as its JSON payload."""
    headers = {
        name: value
        for name, value in request.headers.items()
        if name.lower() not in {"content-length", "content-type"}
    }
    return httpx.Request(request.method, request.url, headers=headers, json=body)


def _issued_session(response: httpx.Response) -> tuple[str, str] | None:
    """The `(access, refresh)` pair a response hands out, if it hands one out."""
    if "application/json" not in response.headers.get("content-type", ""):
        return None
    body = response.json()
    session = body.get("session") if isinstance(body, dict) else None
    if isinstance(session, dict) and session.get("access_token") and session.get("refresh_token"):
        return str(session["access_token"]), str(session["refresh_token"])
    return None
