"""Shared AST helpers for the guards. Docstrings are never scanned."""

from __future__ import annotations

import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = PROJECT_ROOT / "app"
FEATURES_ROOT = APP_ROOT / "features"
CORE_ROOT = APP_ROOT / "core"
TESTS_ROOT = PROJECT_ROOT / "tests"
SQL_ROOT = PROJECT_ROOT.parent / "backend" / "sql"


def python_files(root: Path = APP_ROOT) -> list[Path]:
    return sorted(p for p in root.rglob("*.py") if "__pycache__" not in p.parts)


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return path.name


def slice_dirs() -> list[Path]:
    if not FEATURES_ROOT.exists():
        return []
    return sorted(
        p
        for p in FEATURES_ROOT.iterdir()
        if p.is_dir() and not p.name.startswith(("_", ".")) and p.name != "__pycache__"
    )


def slice_of(path: Path) -> str | None:
    try:
        return path.relative_to(FEATURES_ROOT).parts[0]
    except ValueError:
        return None


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def imported_modules(path: Path) -> set[str]:
    """Absolute module names a file imports, including `from x import y` as `x.y`."""
    modules: set[str] = set()
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            modules.add(node.module)
            modules.update(f"{node.module}.{alias.name}" for alias in node.names)
    return modules


def attribute_calls(path: Path) -> set[str]:
    """Names of every `x.<name>(...)` call in a file."""
    return {
        node.func.attr
        for node in ast.walk(parse(path))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
