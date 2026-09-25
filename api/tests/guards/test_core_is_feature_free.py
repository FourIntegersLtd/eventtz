"""`app.core` is the kernel: it never imports a feature or an adapter."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import CORE_ROOT, imported_modules, python_files, rel

# Module prefixes the kernel must never import.
BANNED = ("app.features", "app.adapters", "app.main")


def violations(path: Path) -> list[str]:
    """Banned modules the file imports."""
    return sorted(module for module in imported_modules(path) if module.startswith(BANNED))


@pytest.mark.parametrize("path", python_files(CORE_ROOT), ids=rel)
def test_core_never_imports_a_feature(path: Path) -> None:
    # openapi.py builds the whole app to dump its schema, so it alone may import app.main (lazily).
    allowed = {"app.main.create_app", "app.main"} if path.name == "openapi.py" else set()
    bad = [module for module in violations(path) if module not in allowed]
    assert not bad, f"{rel(path)} imports {bad}; core must not know about features."


def test_the_guard_would_catch_core_importing_a_feature(tmp_path: Path) -> None:
    planted = tmp_path / "kernel_module.py"
    planted.write_text("from app.features.content.service import list_posts\n", encoding="utf-8")
    assert violations(planted) == ["app.features.content.service", "app.features.content.service.list_posts"]
