"""One transaction per request, owned by `core/db.py` (copied from OSCE `platform-api`).

A service that commits mid-way turns "all or nothing" into "some". The request
dependency opens the transaction and commits when the handler returns; nothing
else commits, rolls back or begins one.

Deviation from OSCE: a repository may open a savepoint (`begin_nested`) around
a write that can hit a unique index. A savepoint never ends the request's
transaction; it is what keeps that transaction usable after the clash, since a
failed statement otherwise aborts everything after it.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import CORE_ROOT, attribute_names, python_files, rel

# Ending or restarting the transaction is core's job alone.
TRANSACTION_CONTROL = {"commit", "rollback", "transaction", "begin", "begin_nested"}
SAVEPOINT = "begin_nested"
ALLOWED = {CORE_ROOT / "db.py", CORE_ROOT / "jobs.py"}
# `flush` only stages work inside the open transaction; a repository needs it for
# generated ids. A service calling it is reaching into the unit of work.
FLUSH = "flush"


def is_repository(path: Path) -> bool:
    """True for `repository*.py` files."""
    return path.name.startswith("repository")


def transaction_calls(path: Path) -> list[str]:
    """Transaction control this file may not use (repositories may use savepoints)."""
    banned = TRANSACTION_CONTROL - {SAVEPOINT} if is_repository(path) else TRANSACTION_CONTROL
    return sorted(attribute_names(path) & banned)


@pytest.mark.parametrize("path", [path for path in python_files() if path not in ALLOWED], ids=rel)
def test_only_core_db_controls_transactions(path: Path) -> None:
    bad = transaction_calls(path)
    assert not bad, (
        f"{rel(path)} calls {bad}. The request transaction is opened and committed by "
        "core.db.get_session; raise an AppError to roll back."
    )


@pytest.mark.parametrize(
    "path", [path for path in python_files() if path not in ALLOWED and not is_repository(path)], ids=rel
)
def test_only_repositories_flush(path: Path) -> None:
    assert FLUSH not in attribute_names(path), (
        f"{rel(path)} calls flush; if a service needs a generated id, have the repository return the row."
    )


def test_the_guard_would_catch_a_commit_or_a_savepoint_in_a_service(tmp_path: Path) -> None:
    service = tmp_path / "service.py"
    service.write_text(
        "async def save(session):\n    async with session.begin_nested():\n        await session.commit()\n",
        encoding="utf-8",
    )
    assert transaction_calls(service) == ["begin_nested", "commit"]


def test_a_repository_may_open_a_savepoint_but_not_commit(tmp_path: Path) -> None:
    repository = tmp_path / "repository.py"
    repository.write_text(
        "async def save(session):\n    async with session.begin_nested():\n        await session.commit()\n",
        encoding="utf-8",
    )
    assert transaction_calls(repository) == ["commit"]
