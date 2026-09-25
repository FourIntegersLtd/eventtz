"""Every name says what it holds: no single-letter identifiers anywhere, loops included.

A new engineer should be able to read any line without scrolling up to work out
what `p` or `x` means. The only exception is `_`, the conventional "ignored" name.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, TESTS_ROOT, parse, python_files, rel

ALLOWED_SHORT_NAMES = {"_"}


def bound_names(tree: ast.AST) -> list[tuple[int, str]]:
    """Every name the code *introduces* (assignments, loop targets, args, defs, aliases) with its line."""
    introduced: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            introduced.append((node.lineno, node.id))
        elif isinstance(node, ast.arg):
            introduced.append((node.lineno, node.arg))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) or (
            isinstance(node, ast.ExceptHandler) and node.name
        ):
            introduced.append((node.lineno, str(node.name)))
        elif isinstance(node, ast.alias) and node.asname:
            introduced.append((node.lineno, node.asname))
    return introduced


def violations(path: Path) -> list[str]:
    """`line:name` for each single-letter name in the file."""
    return [
        f"{line}:{name}"
        for line, name in bound_names(parse(path))
        if len(name) == 1 and name not in ALLOWED_SHORT_NAMES
    ]


@pytest.mark.parametrize("path", python_files(APP_ROOT) + python_files(TESTS_ROOT), ids=rel)
def test_no_single_letter_names(path: Path) -> None:
    offending = violations(path)
    assert not offending, f"{rel(path)} uses single-letter names {offending}; name what the value is."


def test_the_guard_would_catch_a_loop_variable(tmp_path: Path) -> None:
    planted = tmp_path / "service.py"
    planted.write_text("for i in range(3):\n    print(i)\nitems = [x for x in []]\n", encoding="utf-8")
    assert sorted(violations(planted)) == ["1:i", "3:x"]
