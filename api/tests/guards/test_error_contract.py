"""Features raise `AppError`s, never `HTTPException`; every route documents its shape and errors."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from fastapi.routing import APIRoute

from app.main import create_app
from tests.guards._scan import FEATURES_ROOT, imported_modules, parse, python_files, rel


def violations(path: Path) -> list[str]:
    bad = sorted(m for m in imported_modules(path) if m.endswith("HTTPException"))
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.Raise) and node.exc is not None:
            target = node.exc.func if isinstance(node.exc, ast.Call) else node.exc
            if isinstance(target, ast.Name) and target.id in {"HTTPException", "Exception"}:
                bad.append(f"raise {target.id}")
    return bad


@pytest.mark.parametrize("path", python_files(FEATURES_ROOT), ids=rel)
def test_features_raise_app_errors(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)}: {bad}. Raise an AppError subclass from the slice's errors.py."


def test_the_guard_would_catch_an_http_exception(tmp_path: Path) -> None:
    f = tmp_path / "service.py"
    f.write_text(
        "from fastapi import HTTPException\ndef f():\n    raise HTTPException(404)\n", encoding="utf-8"
    )
    assert violations(f) == ["fastapi.HTTPException", "raise HTTPException"]


def api_routes() -> list[APIRoute]:
    return [r for r in create_app().routes if isinstance(r, APIRoute) and r.include_in_schema]


@pytest.mark.parametrize("route", api_routes(), ids=lambda r: f"{sorted(r.methods)} {r.path}")
def test_every_route_declares_its_response_and_errors(route: APIRoute) -> None:
    no_body = route.status_code == 204 or route.response_class.__name__ in {
        "Response",
        "StreamingResponse",
        "RedirectResponse",
        "HTMLResponse",
        "PlainTextResponse",
    }
    assert no_body or route.response_model is not None, f"{route.path} has no response_model"
    assert any(int(status) >= 400 for status in route.responses), (
        f"{route.path} declares no errors; add responses=error_responses(...)"
    )
