"""`domain.py` is pure: no database, HTTP, framework or adapter imports."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, imported_modules, rel

# I/O and framework libraries a pure domain module must not import.
BANNED = (
    "supabase",
    "httpx",
    "requests",
    "fastapi",
    "stripe",
    "openai",
    "boto3",
    "app.adapters",
    "app.core.db",
)


def domain_files() -> list[Path]:
    """Every `domain*.py` in every slice."""
    return sorted(path for path in FEATURES_ROOT.rglob("domain*.py") if "__pycache__" not in path.parts)


def violations(path: Path) -> list[str]:
    """Banned modules the file imports."""
    return sorted(module for module in imported_modules(path) if module.startswith(BANNED))


@pytest.mark.parametrize("path", domain_files(), ids=rel)
def test_domain_has_no_io(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} imports {bad}; domain rules must be pure."


def test_the_guard_would_catch_io_in_a_domain(tmp_path: Path) -> None:
    planted = tmp_path / "domain.py"
    planted.write_text("import httpx\nfrom app.core.db import service_client\n", encoding="utf-8")
    assert violations(planted) == ["app.core.db.service_client", "httpx"]
