"""API schemas never import row models or repositories: rows are mapped in the service."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, imported_modules, rel


def schema_files() -> list[Path]:
    return sorted(p for p in FEATURES_ROOT.rglob("schemas*.py") if "__pycache__" not in p.parts)


def violations(path: Path) -> list[str]:
    return sorted(
        m
        for m in imported_modules(path)
        if m.split(".")[-1].startswith(("models", "repository")) or ".models." in m or ".repository." in m
    )


@pytest.mark.parametrize("path", schema_files(), ids=rel)
def test_schemas_do_not_expose_rows(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} imports {bad}; map rows to schemas in the service."


def test_the_guard_would_catch_a_row_in_a_schema(tmp_path: Path) -> None:
    f = tmp_path / "schemas.py"
    f.write_text("from app.features.content.models import PostRow\n", encoding="utf-8")
    assert violations(f) == ["app.features.content.models", "app.features.content.models.PostRow"]
