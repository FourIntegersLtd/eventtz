"""Every part of the code explains itself to a newly onboarded engineer.

- Every module (including package `__init__.py`) opens with a docstring saying what it holds.
- Every class and function in `app/` has a docstring, private helpers and nested route handlers included.
- In `tests/`, helpers, fixtures and classes need docstrings; `test_*` functions are exempt
  because their names are the sentence that describes them.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import ACCEPTANCE_ROOT, APP_ROOT, TESTS_ROOT, parse, python_files, rel

Definition = ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef


def undocumented(path: Path, *, exempt_test_functions: bool) -> list[str]:
    """Names of the module / classes / functions in `path` that lack a docstring."""
    tree = parse(path)
    missing: list[str] = [] if ast.get_docstring(tree) else ["<module>"]
    for node in ast.walk(tree):
        if not isinstance(node, Definition):
            continue
        if exempt_test_functions and node.name.startswith("test_"):
            continue
        if not ast.get_docstring(node):
            missing.append(f"{node.lineno}:{node.name}")
    return missing


@pytest.mark.parametrize("path", python_files(APP_ROOT), ids=rel)
def test_app_code_is_documented(path: Path) -> None:
    missing = undocumented(path, exempt_test_functions=False)
    assert not missing, f"{rel(path)} has no docstring for {missing}"


@pytest.mark.parametrize("path", python_files(TESTS_ROOT) + python_files(ACCEPTANCE_ROOT), ids=rel)
def test_test_code_is_documented(path: Path) -> None:
    missing = undocumented(path, exempt_test_functions=True)
    assert not missing, f"{rel(path)} has no docstring for {missing}"


def test_the_guard_would_catch_an_undocumented_helper(tmp_path: Path) -> None:
    planted = tmp_path / "service.py"
    planted.write_text('"""Module."""\ndef _helper():\n    return 1\n', encoding="utf-8")
    assert undocumented(planted, exempt_test_functions=False) == ["2:_helper"]


def test_the_guard_exempts_only_test_functions_in_tests(tmp_path: Path) -> None:
    planted = tmp_path / "test_x.py"
    planted.write_text("def test_it():\n    pass\ndef build():\n    pass\n", encoding="utf-8")
    assert undocumented(planted, exempt_test_functions=True) == ["<module>", "3:build"]
