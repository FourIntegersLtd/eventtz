"""API schemas never import mapped tables, rows or repositories; the service maps rows to schemas."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, imported_modules, rel


def schema_files() -> list[Path]:
    """Every `schemas*.py` in every slice."""
    return sorted(path for path in FEATURES_ROOT.rglob("schemas*.py") if "__pycache__" not in path.parts)


def violations(path: Path) -> list[str]:
    """Mapped-table, row or repository modules the schema file imports."""
    storage_modules = ("models", "rows", "repository")
    return sorted(
        module
        for module in imported_modules(path)
        if module.split(".")[-1].startswith(storage_modules)
        or any(f".{name}." in module for name in storage_modules)
    )


@pytest.mark.parametrize("path", schema_files(), ids=rel)
def test_schemas_do_not_expose_rows(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} imports {bad}; map rows to schemas in the service."


def test_the_guard_would_catch_a_row_in_a_schema(tmp_path: Path) -> None:
    """A schema importing a row or a mapped table is reported."""
    planted = tmp_path / "schemas.py"
    planted.write_text(
        "from app.features.content.rows import PostRow\nfrom app.features.content.models import BlogPost\n",
        encoding="utf-8",
    )
    assert violations(planted) == [
        "app.features.content.models.BlogPost",
        "app.features.content.rows.PostRow",
    ]
