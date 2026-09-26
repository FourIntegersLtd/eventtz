"""Queries live only in a slice's repository (copied from OSCE `platform-api`).

Under an ORM a query is rarely a string, so matching SQL text is not enough:
`select(Vendor).where(...)` in a service is the same mistake spelled
differently. Outside a repository this scans for SQL literals, SQLAlchemy query
construction and execution, and imports of mapped models.

Eventtz is stricter than OSCE on models: only the slice's own repository (and
`models.py` itself) imports them. Services work with the plain `rows.py` types
the repository returns, which is what keeps the baseline goldens valid.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from tests.guards._scan import (
    CORE_ROOT,
    attribute_names,
    imported_modules,
    names_imported_from,
    python_files,
    rel,
    slice_of,
    string_literals,
)

SQL_SHAPE = re.compile(
    r"^\s*("
    r"select\s+.+?\s+from\s|select\s+\d|with\s+\w+\s+as\s*\(|"
    r"insert\s+into\s|update\s+\S+\s+set\s|delete\s+from\s|"
    r"create\s+(table|index|schema|extension|function|type)|alter\s+table|drop\s+(table|index|schema)"
    r")",
    re.IGNORECASE | re.DOTALL,
)
# Session methods that run a query. Transaction control is `test_services_never_commit.py`'s.
EXECUTION_METHODS = {"execute", "scalar", "scalars", "stream_scalars"}
# Query builders imported from sqlalchemy. `table`/`column` build the lightweight
# handles a repository uses to read another slice's table.
QUERY_BUILDERS = {
    "select",
    "insert",
    "update",
    "delete",
    "text",
    "exists",
    "union",
    "union_all",
    "table",
    "column",
}
# `jobs.py` writes the queue row inside the caller's transaction (ADR 0008).
CORE_QUERY_HELPERS = {CORE_ROOT / "jobs.py"}


def is_repository(path: Path) -> bool:
    """True for `repository*.py` files."""
    return path.name.startswith("repository")


def may_query(path: Path) -> bool:
    """Repositories, mapped models and the core query helpers."""
    return is_repository(path) or path.name == "models.py" or path in CORE_QUERY_HELPERS


def sql_literals(path: Path) -> list[str]:
    """String literals shaped like SQL statements."""
    return [literal for literal in string_literals(path) if SQL_SHAPE.match(literal)]


def orm_query_use(path: Path) -> list[str]:
    """Query builders imported from sqlalchemy, and session execution calls."""
    found = names_imported_from(path, "sqlalchemy") & QUERY_BUILDERS
    found |= attribute_names(path) & EXECUTION_METHODS
    return sorted(found)


def model_imports(path: Path) -> list[str]:
    """Mapped-model imports this file may not make: any slice's unless it is that slice's repository."""
    own_slice = slice_of(path)
    found = []
    for module in imported_modules(path):
        parts = module.split(".")
        if parts[:2] != ["app", "features"] or len(parts) < 4 or parts[3] != "models":
            continue
        if not (is_repository(path) and parts[2] == own_slice) and path.name != "models.py":
            found.append(module)
    return sorted(found)


@pytest.mark.parametrize("path", [path for path in python_files() if not may_query(path)], ids=rel)
def test_no_sql_outside_repositories(path: Path) -> None:
    found = sql_literals(path)
    assert not found, f"{rel(path)} contains SQL: {found[0][:60]!r}. Move it into the slice's repository.py."


@pytest.mark.parametrize("path", [path for path in python_files() if not may_query(path)], ids=rel)
def test_no_orm_queries_outside_repositories(path: Path) -> None:
    found = orm_query_use(path)
    assert not found, (
        f"{rel(path)} builds or runs a query ({found}); "
        "give the repository a function named for what is wanted."
    )


@pytest.mark.parametrize("path", python_files(), ids=rel)
def test_only_a_slices_repository_imports_its_models(path: Path) -> None:
    found = model_imports(path)
    assert not found, f"{rel(path)} imports {found}; only the owning slice's repository.py may."


@pytest.mark.parametrize("path", [path for path in python_files() if path.name == "models.py"], ids=rel)
def test_models_declare_columns_not_relationships(path: Path) -> None:
    """A relationship issues queries nobody wrote; loading the other side is a repository's job."""
    assert "relationship" not in names_imported_from(path, "sqlalchemy"), (
        f"{rel(path)} declares a relationship."
    )


def test_the_guard_would_catch_a_query_in_a_service(tmp_path: Path) -> None:
    service = tmp_path / "service.py"
    service.write_text(
        "from sqlalchemy import select\n"
        "from app.features.vendors.models import Vendor\n"
        "async def load(session):\n"
        "    await session.execute('select id from vendors where id = 1')\n"
        "    return await session.execute(select(Vendor))\n",
        encoding="utf-8",
    )
    assert orm_query_use(service) == ["execute", "select"]
    assert sql_literals(service) == ["select id from vendors where id = 1"]
    assert model_imports(service) == ["app.features.vendors.models.Vendor"]


def test_the_guard_ignores_prose_and_a_service_that_calls_its_repository(tmp_path: Path) -> None:
    service = tmp_path / "service.py"
    service.write_text(
        '"""select * from users, in a docstring, is prose."""\n'
        "from app.features.vendors import repository\n"
        'FAILED = "update failed, try again"\n'
        "async def load(session, user_id):\n"
        "    return await repository.get_vendor(session, user_id)\n",
        encoding="utf-8",
    )
    assert (orm_query_use(service), sql_literals(service), model_imports(service)) == ([], [], [])
