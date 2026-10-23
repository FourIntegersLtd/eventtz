"""Every api/ route already exists in the baseline: the rebuild never invents or renames a URL.

`openapi.baseline.json` is the frozen export of the OLD backend and is never re-exported from
api/ (that would make this guard pass by construction); `test_the_baseline_file_is_the_frozen_export`
pins its hash. Paths
are compared with their parameter names blanked (`{post_id}` and `{id}` are the
same URL). Run `make parity` to list the baseline routes api/ does not serve yet.

Additive routes are allow-listed explicitly: whole prefixes in `ADDITIVE_PATH_PREFIXES` and
single operations in `ADDITIVE_OPERATIONS`. The first was `/api/v1/realtime/` (workstream
9, ADR 0005). `EventSource` cannot send an Authorization header, so the SSE
stream authenticates with a short-lived ticket minted by `POST
/api/v1/realtime/stream-ticket`, which has no baseline equivalent (the baseline
stream authenticates with a cookie instead). That route does not rename or
remove anything the baseline serves, so re-exporting `openapi.baseline.json`
from the (unmodified) baseline is not required for it.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from app.main import create_app
from tests.guards._scan import PROJECT_ROOT

BASELINE_DOCUMENT = PROJECT_ROOT / "openapi.baseline.json"
# sha256 of the old backend's export (178 operations). Changing it is a deliberate act, see
# `test_the_baseline_file_is_the_frozen_export`.
BASELINE_SHA256 = "62548d29ed1ce167029e7654d58120352e15c5159b0ef77264996f3c97e876f6"
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
    # Staff-checked public liability insurance for higher-risk vendors.
    "/api/v1/admin/vendors/{}/insurance",
    # Split payouts and damage deposits (terms remediation 3.1, 3.5).
    "/api/v1/client/booking-requests/{}/confirm-delivery",
    "/api/v1/vendor/booking-requests/{}/deposit-claim",
    "/api/v1/admin/bookings/{}/deposit-claim/resolve",
)
# Single new operations whose path is a prefix of baseline routes, so they are matched exactly
# (a prefix entry would also let every route under them through).
ADDITIVE_OPERATIONS = frozenset(
    {
        # One vendor for the staff vendor page (the baseline only had the list, shown in a popup).
        ("GET", "/api/v1/admin/vendors/{}"),
        # Staff Messages badge total, summed in SQL (the baseline summed up to 200 threads in the browser).
        ("GET", "/api/v1/admin/messages/unread-count"),
        # Portal home dashboards and admin daily financials (server-side aggregates).
        ("GET", "/api/v1/client/dashboard"),
        ("GET", "/api/v1/vendor/dashboard"),
        ("GET", "/api/v1/admin/financials/daily"),
        # Presigned S3 upload URLs so large files bypass the Vercel proxy (docs/runbooks/s3-uploads.md).
        ("POST", "/api/v1/media/upload-urls"),
        # Portfolio AI analysis from an already-uploaded image URL (companion to the presigned upload).
        ("POST", "/api/v1/vendor/onboarding/ai/analyze-portfolio-image-url"),
    }
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
        for operation in api_operations() - baseline_operations() - ADDITIVE_OPERATIONS
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


def test_the_guard_still_flags_routes_outside_the_additive_prefixes(tmp_path: Path) -> None:
    """An invented route outside `ADDITIVE_PATH_PREFIXES` still fails, even alongside an exempt one."""
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


def baseline_digest(path: Path) -> str:
    """The sha256 hex digest of a baseline file's bytes."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_the_baseline_file_is_the_frozen_export() -> None:
    """`openapi.baseline.json` is the old backend's export and is never re-exported from api/.

    Regenerating it from the new app (as `make openapi` does for `openapi.json`) makes every
    route "exist in the baseline", so the guard above can never fail. A deliberate change, such as
    a fresh export from the old backend, means updating `BASELINE_SHA256` in the same reviewed
    change. A new api/ route goes in `ADDITIVE_OPERATIONS` or `ADDITIVE_PATH_PREFIXES` instead.
    """
    assert baseline_digest(BASELINE_DOCUMENT) == BASELINE_SHA256


def test_the_hash_guard_fails_on_a_modified_baseline(tmp_path: Path) -> None:
    """The pinned hash matches the original bytes and rejects a copy changed by a single byte."""
    original = BASELINE_DOCUMENT.read_bytes()
    unmodified = tmp_path / "unmodified.json"
    unmodified.write_bytes(original)
    modified = tmp_path / "modified.json"
    modified.write_bytes(original + b" ")
    assert baseline_digest(unmodified) == BASELINE_SHA256
    assert baseline_digest(modified) != BASELINE_SHA256


if __name__ == "__main__":
    # `make parity`: what is left to rebuild.
    missing = sorted(
        baseline_operations() - api_operations(), key=lambda operation: (operation[1], operation[0])
    )
    total = len(baseline_operations())
    for method, path in missing:
        print(f"{method:7} {path}")  # noqa: T201 - a CLI report
    print(f"\n{total - len(missing)}/{total} baseline operations served by api/; {len(missing)} to go.")  # noqa: T201
