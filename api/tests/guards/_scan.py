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
# The repo-root freeze suite; held to the same naming and documentation rules as tests/.
ACCEPTANCE_ROOT = PROJECT_ROOT.parent / "acceptance"


def python_files(root: Path = APP_ROOT) -> list[Path]:
    """Every `.py` file under `root`, sorted so parametrized test ids are stable.

    Skips caches and hidden folders (`.venv`, and `acceptance/.run/`, which holds a
    throwaway copy of the baseline backend).
    """
    return sorted(
        path
        for path in root.rglob("*.py")
        if not any(part == "__pycache__" or part.startswith(".") for part in path.relative_to(root).parts)
    )


def rel(path: Path) -> str:
    """`path` relative to `api/` for readable failure messages (just the name for temp files)."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return path.name


def slice_dirs() -> list[Path]:
    """Every slice folder under `app/features/` (skips private and cache folders)."""
    if not FEATURES_ROOT.exists():
        return []
    return sorted(
        folder
        for folder in FEATURES_ROOT.iterdir()
        if folder.is_dir() and not folder.name.startswith(("_", ".")) and folder.name != "__pycache__"
    )


def slice_of(path: Path) -> str | None:
    """The slice a file belongs to (`content` for `app/features/content/service.py`), or `None`."""
    try:
        return path.relative_to(FEATURES_ROOT).parts[0]
    except ValueError:
        return None


def parse(path: Path) -> ast.Module:
    """The file's syntax tree."""
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def imported_modules(path: Path) -> set[str]:
    """Absolute module names a file imports, including `from x import y` as `x.y`."""
    modules: set[str] = set()
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            # Only the full `x.y` name: `from app.features.staff import service` is the staff
            # *service*, and must not also count as importing the bare `app.features.staff`.
            modules.update(f"{node.module}.{alias.name}" for alias in node.names)
    return modules


def attribute_calls(path: Path) -> set[str]:
    """Method names of every `something.<name>(...)` call in a file."""
    return {
        node.func.attr
        for node in ast.walk(parse(path))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
