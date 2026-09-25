"""Tests inject fakes (`tests/support/fakes.py`, `dependency_overrides`); they never patch `app.…`."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import TESTS_ROOT, parse, python_files, rel


def violations(path: Path) -> list[str]:
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


@pytest.mark.parametrize("path", [p for p in python_files(TESTS_ROOT) if "guards" not in p.parts], ids=rel)
def test_no_patching_app_modules(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} patches {bad}; add a port and inject a fake instead."


def test_the_guard_would_catch_a_patch(tmp_path: Path) -> None:
    f = tmp_path / "test_x.py"
    f.write_text("from unittest.mock import patch\npatch('app.core.db.service_client')\n", encoding="utf-8")
    assert violations(f) == ["app.core.db.service_client"]
