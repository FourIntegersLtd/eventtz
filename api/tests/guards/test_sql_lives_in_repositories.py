"""Supabase calls (`.table`, `.rpc`, `.storage`, `.from_`) live only in a slice's repository.

`core/db.py` owns the clients and `core/auth.py` reads the caller's `users` row;
nothing else outside a repository talks to the database.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, attribute_calls, python_files, rel

# Supabase client methods that reach the database or storage.
DB_CALLS = {"table", "rpc", "from_", "storage"}
# Kernel files allowed to talk to Supabase directly (see module docstring).
ALLOWED = {APP_ROOT / "core" / "db.py", APP_ROOT / "core" / "auth.py"}


def is_repository(path: Path) -> bool:
    """True for `repository*.py` files and anything inside a `repository/` package."""
    return path.name.startswith("repository") or path.parent.name == "repository"


def violations(path: Path) -> list[str]:
    """Database methods called from a file that is not allowed to call them."""
    if is_repository(path) or path in ALLOWED:
        return []
    return sorted(attribute_calls(path) & DB_CALLS)


@pytest.mark.parametrize("path", python_files(), ids=rel)
def test_database_calls_live_in_repositories(path: Path) -> None:
    bad = violations(path)
    assert not bad, f"{rel(path)} calls {bad}; move the query into the slice's repository.py."


def test_the_guard_would_catch_a_query_in_a_service(tmp_path: Path) -> None:
    service = tmp_path / "service.py"
    service.write_text(
        "def list_users(db):\n    return db.table('users').select('*').execute()\n", encoding="utf-8"
    )
    assert violations(service) == ["table"]
