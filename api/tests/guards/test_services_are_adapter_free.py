"""A service reaches the outside world only through a `core/ports.py` port, never an adapter or raw HTTP.

`vendors/service_ai.py` once fetched a caller-supplied URL with `httpx` and imported an adapter
helper, which skipped the storage port's size cap and ownership checks. Ports are what tests fake.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, imported_modules, python_files, rel

# Modules a service file may not import (the module itself or anything below it).
BANNED_PREFIXES = ("app.adapters", "httpx")

# Services with a known violation; none today. Add a path here only with a reason.
EXEMPT: set[str] = set()


def is_service(path: Path) -> bool:
    """True for `service*.py` files inside a slice."""
    return path.name.startswith("service")


def violations(path: Path) -> list[str]:
    """Banned modules this file imports."""
    return sorted(
        module
        for module in imported_modules(path)
        if any(module == prefix or module.startswith(f"{prefix}.") for prefix in BANNED_PREFIXES)
    )


@pytest.mark.parametrize(
    "path",
    [path for path in python_files(FEATURES_ROOT) if is_service(path) and rel(path) not in EXEMPT],
    ids=rel,
)
def test_services_use_ports_not_adapters(path: Path) -> None:
    bad = violations(path)
    assert not bad, (
        f"{rel(path)} imports {bad}. Add a method to the port in core/ports.py and take it as an argument."
    )


def test_the_guard_would_catch_an_adapter_or_httpx_import_in_a_service(tmp_path: Path) -> None:
    planted = tmp_path / "service_ai.py"
    planted.write_text(
        "import httpx\nfrom app.adapters.s3_storage import is_our_url\nfrom app.core.ports import Storage\n",
        encoding="utf-8",
    )
    assert is_service(planted)
    assert violations(planted) == ["app.adapters.s3_storage.is_our_url", "httpx"]
