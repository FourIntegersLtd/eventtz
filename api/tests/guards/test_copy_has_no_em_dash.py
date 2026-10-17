"""User-facing copy never uses an em dash (house style).

Every string literal in `app/` can reach a user (error messages, tips, email builders), so all
of them are scanned, plus the email templates. Docstrings are not copy and are skipped. A regex
character class that *detects* dashes a vendor typed (`[-–—]`) is not copy either.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, parse, python_files, rel

EM_DASH = "—"
DASH_CLASS = f"[-–{EM_DASH}]"
TEMPLATES_ROOT = APP_ROOT / "features" / "notifications" / "templates"


def _docstring_nodes(tree: ast.Module) -> set[int]:
    """`id()`s of the constant nodes that are docstrings of the module, classes and functions."""
    definitions = (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
    owners = [tree, *(node for node in ast.walk(tree) if isinstance(node, definitions))]
    docstrings: set[int] = set()
    for owner in owners:
        first = owner.body[0] if owner.body else None
        if not (isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant)):
            continue
        if isinstance(first.value.value, str):
            docstrings.add(id(first.value))
    return docstrings


def violations(path: Path) -> list[int]:
    """Line numbers of string literals in `path` that contain an em dash."""
    tree = parse(path)
    docstrings = _docstring_nodes(tree)
    return sorted(
        node.lineno
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and id(node) not in docstrings
        and EM_DASH in node.value.replace(DASH_CLASS, "")
    )


def template_files() -> list[Path]:
    """Every email template (html and txt)."""
    return sorted(path for path in TEMPLATES_ROOT.rglob("*") if path.is_file())


@pytest.mark.parametrize("path", python_files(), ids=rel)
def test_string_literals_have_no_em_dash(path: Path) -> None:
    lines = violations(path)
    assert not lines, f"{rel(path)} lines {lines} use an em dash. Use a comma, colon or full stop."


@pytest.mark.parametrize("path", template_files(), ids=rel)
def test_email_templates_have_no_em_dash(path: Path) -> None:
    assert EM_DASH not in path.read_text(encoding="utf-8"), f"{rel(path)} uses an em dash."


def test_the_guard_would_catch_an_em_dash_in_copy(tmp_path: Path) -> None:
    module = tmp_path / "copy.py"
    module.write_text(
        f'"""Docs may say a — b."""\n'
        f'PATTERN = r"\\d+\\s*{DASH_CLASS}\\s*\\d+"\n'
        f'TIP = "Add a photo {EM_DASH} clients trust faces."\n',
        encoding="utf-8",
    )
    assert violations(module) == [3]
