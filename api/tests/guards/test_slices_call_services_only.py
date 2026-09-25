"""A slice reaches another slice only through its `service*`, `schemas` or `errors`."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, imported_modules, python_files, rel, slice_of

PUBLIC = ("service", "schemas", "errors")


def violations(path: Path, own: str) -> list[str]:
    bad: set[str] = set()
    for module in imported_modules(path):
        parts = module.split(".")
        if not module.startswith("app.features.") or len(parts) < 3 or parts[2] == own:
            continue
        if len(parts) < 4 or not parts[3].startswith(PUBLIC):
            bad.add(".".join(parts[:4]))
    return sorted(bad)


@pytest.mark.parametrize("path", python_files(FEATURES_ROOT), ids=rel)
def test_slices_meet_only_at_services(path: Path) -> None:
    own = slice_of(path) or ""
    bad = violations(path, own)
    assert not bad, f"{rel(path)} imports {bad}; call that slice's service instead."


def test_the_guard_would_catch_a_cross_slice_repository_import(tmp_path: Path) -> None:
    f = tmp_path / "service.py"
    f.write_text(
        "from app.features.identity.repository import UserRepository\n"
        "from app.features.identity.service import get_user\n",
        encoding="utf-8",
    )
    assert violations(f, "bookings") == ["app.features.identity.repository"]
