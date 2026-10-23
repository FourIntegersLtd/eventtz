"""Shared AST helpers for the guards. Docstrings are never scanned."""

from __future__ import annotations

import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = PROJECT_ROOT / "app"
FEATURES_ROOT = APP_ROOT / "features"
CORE_ROOT = APP_ROOT / "core"
TESTS_ROOT = PROJECT_ROOT / "tests"
# Operator scripts (seeds, one-off sends) run against real databases; held to the same data-access rules.
SCRIPTS_ROOT = PROJECT_ROOT / "scripts"
# The repo-root freeze suite; held to the same naming and documentation rules as tests/.
ACCEPTANCE_ROOT = PROJECT_ROOT.parent / "acceptance"


def python_files(root: Path = APP_ROOT) -> list[Path]:
    """Every `.py` file under `root`, sorted so parametrized test ids are stable.

    Skips caches and hidden folders (`.venv`).
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


def docstring_nodes(tree: ast.AST) -> set[int]:
    """The ids of the string constants that are docstrings (prose, not code)."""
    ids: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            body = getattr(node, "body", [])
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                ids.add(id(body[0].value))
    return ids


def string_literals(path: Path) -> list[str]:
    """Runtime string literals in a file (docstrings excluded), original case."""
    tree = parse(path)
    docstrings = docstring_nodes(tree)
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings
    ]


def attribute_names(path: Path) -> set[str]:
    """Every `something.<name>` attribute a file uses, called or not."""
    return {node.attr for node in ast.walk(parse(path)) if isinstance(node, ast.Attribute)}


def names_imported_from(path: Path, package: str) -> set[str]:
    """Names a file imports from a package, e.g. `select` in `from sqlalchemy import select`.

    Matching bare tokens instead would catch `dict.update`, which is how a guard
    earns a reputation for crying wolf and gets deleted.
    """
    found: set[str] = set()
    for node in ast.walk(parse(path)):
        if (
            isinstance(node, ast.ImportFrom)
            and node.module
            and (node.module == package or node.module.startswith(f"{package}."))
        ):
            found.update(alias.name for alias in node.names)
    return found
