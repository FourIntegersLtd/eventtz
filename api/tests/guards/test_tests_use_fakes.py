"""Tests inject fakes (`tests/support/fakes.py`, `dependency_overrides`); they never patch `app.…`."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import TESTS_ROOT, parse, python_files, rel


def violations(path: Path) -> list[str]:
    """Targets of `patch("app.…")` / `setattr("app.…")` calls in the file."""
    bad: list[str] = []
    for node in ast.walk(parse(path)):
        if not isinstance(node, ast.Call):
            continue
        name = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", "")
        if name in {"patch", "setattr"} and node.args:
            first = node.args[0]
            if (
                isinstance(first, ast.Constant)
                and isinstance(first.value, str)
                and first.value.startswith("app.")
            ):
                bad.append(first.value)
    return bad


@pytest.mark.parametrize(
    "path", [path for path in python_files(TESTS_ROOT) if "guards" not in path.parts], ids=rel
)
def test_no_patching_app_modules(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} patches {bad}; add a port and inject a fake instead."


def test_the_guard_would_catch_a_patch(tmp_path: Path) -> None:
    planted = tmp_path / "test_planted.py"
    planted.write_text(
        "from unittest.mock import patch\npatch('app.core.db.service_client')\n", encoding="utf-8"
    )
    assert violations(planted) == ["app.core.db.service_client"]
