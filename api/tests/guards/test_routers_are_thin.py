"""A router parses, calls its slice's service, returns a schema.

It imports only its own slice's `schemas`, `service*` and `errors`, plus `core`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import imported_modules, rel, slice_dirs


def router_files() -> list[Path]:
    """Every `router*.py` (router, router_admin, router_vendor…) in every slice."""
    return sorted(path for slice_dir in slice_dirs() for path in slice_dir.glob("router*.py"))


def _allowed_sibling(name: str) -> bool:
    """True for the modules of its own slice a router may import."""
    return name in {"schemas", "errors"} or name.startswith("service")


def violations(path: Path, slice_name: str) -> list[str]:
    """Modules the router imports that it should reach only through its service."""
    bad: set[str] = set()
    for module in imported_modules(path):
        parts = module.split(".")  # e.g. ["app", "features", "content", "service", ...]
        if module.startswith("app.adapters"):
            bad.add(module)
        if not module.startswith("app.features.") or len(parts) < 4:
            continue
        if parts[2] != slice_name or not _allowed_sibling(parts[3]):
            bad.add(".".join(parts[:4]))
    return sorted(bad)


@pytest.mark.parametrize("path", router_files(), ids=rel)
def test_router_imports_only_its_schemas_service_and_errors(path: Path) -> None:
    bad = violations(path, path.parent.name)
    assert not bad, f"{rel(path)} imports {bad}. Routers reach everything through their own service."


def test_the_guard_would_catch_a_fat_router(tmp_path: Path) -> None:
    router = tmp_path / "router.py"
    router.write_text(
        "from app.features.content.repository import PostRepository\n"
        "from app.features.media.service import upload\n"
        "from app.features.content.service import list_posts\n",
        encoding="utf-8",
    )
    assert violations(router, "content") == ["app.features.content.repository", "app.features.media.service"]
