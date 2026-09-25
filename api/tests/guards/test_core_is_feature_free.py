"""`app.core` is the kernel: it never imports a feature or an adapter."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import CORE_ROOT, imported_modules, python_files, rel

BANNED = ("app.features", "app.adapters", "app.main")


def violations(path: Path) -> list[str]:
    return sorted(m for m in imported_modules(path) if m.startswith(BANNED))


@pytest.mark.parametrize("path", python_files(CORE_ROOT), ids=rel)
def test_core_never_imports_a_feature(path: Path) -> None:
    allowed = {"app.main.create_app", "app.main"} if path.name == "openapi.py" else set()
    bad = [m for m in violations(path) if m not in allowed]
    assert not bad, f"{rel(path)} imports {bad}; core must not know about features."


def test_the_guard_would_catch_core_importing_a_feature(tmp_path: Path) -> None:
    bad = tmp_path / "x.py"
    bad.write_text("from app.features.content.service import list_posts\n", encoding="utf-8")
    assert violations(bad) == ["app.features.content.service", "app.features.content.service.list_posts"]
