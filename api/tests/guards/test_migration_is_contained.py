"""`app.migration` is a standalone script (workstream 17): nothing else in `app/` imports it.

It has no router, no mapped model and no place in `app.main`'s startup, so a
running server never depends on it. Held separately from
`test_core_is_feature_free.py` because the rule here runs the other way: it is
not that `app.migration` must avoid importing other things, it is that other
things must not come to depend on `app.migration`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, imported_modules, python_files, rel

MIGRATION_ROOT = APP_ROOT / "migration"


def files_outside_migration() -> list[Path]:
    """Every `app/` source file except `app/migration/` itself."""
    return [path for path in python_files(APP_ROOT) if MIGRATION_ROOT not in path.parents]


def violations(path: Path) -> list[str]:
    """`app.migration` modules the file imports."""
    return sorted(module for module in imported_modules(path) if module.startswith("app.migration"))


@pytest.mark.parametrize("path", files_outside_migration(), ids=rel)
def test_nothing_outside_migration_imports_it(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} imports {bad}; app.migration is a standalone script, not a dependency."


def test_the_guard_would_catch_main_importing_migration(tmp_path: Path) -> None:
    planted = tmp_path / "main.py"
    planted.write_text("from app.migration.cli import main as migration_main\n", encoding="utf-8")
    assert violations(planted) == ["app.migration.cli.main"]
