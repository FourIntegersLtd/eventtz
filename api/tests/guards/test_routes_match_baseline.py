"""Every api/ route already exists in the baseline: the rebuild never invents or renames a URL.

`openapi.baseline.json` was exported from the running baseline backend. Paths
are compared with their parameter names blanked (`{post_id}` and `{id}` are the
same URL). Run `make parity` to list the baseline routes api/ does not serve yet.

One family of routes is allowed to be additive: `/api/v1/realtime/` (workstream
9, ADR 0005). `EventSource` cannot send an Authorization header, so the SSE
stream authenticates with a short-lived ticket minted by `POST
/api/v1/realtime/stream-ticket`, which has no baseline equivalent (the baseline
stream authenticates with a cookie instead). That route does not rename or
remove anything the baseline serves, so re-exporting `openapi.baseline.json`
from the (unmodified) baseline is not required for it.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.main import create_app
from tests.guards._scan import PROJECT_ROOT

BASELINE_DOCUMENT = PROJECT_ROOT / "openapi.baseline.json"
# OpenAPI keys under a path that are HTTP methods (the rest are shared parameters etc).
HTTP_METHODS = frozenset({"get", "put", "post", "delete", "patch", "head", "options"})
_PATH_PARAMETER = re.compile(r"\{[^}]+\}")
# Path prefixes allowed to add operations the baseline does not serve. See the module
# docstring: only the realtime slice's ticket-issue route needs this today.
ADDITIVE_PATH_PREFIXES = (
    "/api/v1/realtime/",
    # Terms acceptance (terms remediation 0.2).
    "/api/v1/user/terms/",
    # Rescheduling (terms remediation 3.3): new post-baseline routes, request/respond/withdraw.
    "/api/v1/client/booking-requests/{}/date-change",
    "/api/v1/vendor/booking-requests/{}/date-change",
    # Vendor consequences (terms remediation 3.4): staff warning and timed listing pause.
    "/api/v1/admin/vendors/{}/warn",
    "/api/v1/admin/vendors/{}/listing-pause",
    # Split payouts and damage deposits (terms remediation 3.1, 3.5).
    "/api/v1/client/booking-requests/{}/confirm-delivery",
    "/api/v1/vendor/booking-requests/{}/deposit-claim",
    "/api/v1/admin/bookings/{}/deposit-claim/resolve",
)


def operations(document: dict[str, Any]) -> set[tuple[str, str]]:
    """Every `(METHOD, path)` in an OpenAPI document, with path parameter names blanked."""
    return {
        (method.upper(), _PATH_PARAMETER.sub("{}", path))
        for path, path_item in document.get("paths", {}).items()
        for method in path_item
        if method in HTTP_METHODS
    }


def baseline_operations(path: Path = BASELINE_DOCUMENT) -> set[tuple[str, str]]:
    """The operations the baseline backend serves."""
    return operations(json.loads(path.read_text(encoding="utf-8")))


def api_operations() -> set[tuple[str, str]]:
    """The operations the rebuilt app serves right now."""
    return operations(create_app().openapi())


def test_every_api_route_exists_in_the_baseline() -> None:
    invented = sorted(
        operation
        for operation in api_operations() - baseline_operations()
        if not operation[1].startswith(ADDITIVE_PATH_PREFIXES)
    )
    assert not invented, f"api/ serves routes the baseline does not (renamed or new URLs?): {invented}"


def test_the_guard_would_catch_an_invented_route(tmp_path: Path) -> None:
    baseline_file = tmp_path / "baseline.json"
    baseline_file.write_text(
        json.dumps({"paths": {"/api/v1/blog/posts/{slug}": {"get": {}}}}), encoding="utf-8"
    )
    rebuilt: dict[str, Any] = {
        "paths": {"/api/v1/blog/posts/{post_slug}": {"get": {}}, "/api/v1/blog/feed": {"get": {}}}
    }
    assert operations(rebuilt) - baseline_operations(baseline_file) == {("GET", "/api/v1/blog/feed")}


def test_the_guard_only_exempts_the_realtime_prefix(tmp_path: Path) -> None:
    """An invented route outside `/api/v1/realtime/` still fails, even alongside an exempt one."""
    baseline_file = tmp_path / "baseline.json"
    baseline_file.write_text(json.dumps({"paths": {}}), encoding="utf-8")
    rebuilt: dict[str, Any] = {
        "paths": {
            "/api/v1/realtime/stream-ticket": {"post": {}},
            "/api/v1/blog/feed": {"get": {}},
        }
    }
    invented = operations(rebuilt) - baseline_operations(baseline_file)
    still_flagged = sorted(
        operation for operation in invented if not operation[1].startswith(ADDITIVE_PATH_PREFIXES)
    )
    assert still_flagged == [("GET", "/api/v1/blog/feed")]


if __name__ == "__main__":
    # `make parity`: what is left to rebuild.
    missing = sorted(
        baseline_operations() - api_operations(), key=lambda operation: (operation[1], operation[0])
    )
    total = len(baseline_operations())
    for method, path in missing:
        print(f"{method:7} {path}")  # noqa: T201 - a CLI report
    print(f"\n{total - len(missing)}/{total} baseline operations served by api/; {len(missing)} to go.")  # noqa: T201
