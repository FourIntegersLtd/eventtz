"""Migrations in `backend/sql/` have unique three-digit numbers (the shared DB's one history)."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from tests.guards._scan import SQL_ROOT

# `NNN_snake_case_name.sql`; the number sets the order migrations are applied in.
PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")


def problems(file_names: list[str]) -> list[str]:
    """Badly named files, then any migration number used more than once."""
    bad = [name for name in file_names if not PATTERN.match(name)]
    numbers = Counter(match.group(1) for name in file_names if (match := PATTERN.match(name)))
    bad += [f"duplicate {number}" for number, count in sorted(numbers.items()) if count > 1]
    return bad


def test_migrations_are_uniquely_numbered() -> None:
    file_names = sorted(path.name for path in SQL_ROOT.glob("*.sql"))
    assert file_names, f"no migrations found in {SQL_ROOT}"
    assert problems(file_names) == []


def test_the_guard_would_catch_a_duplicate(tmp_path: Path) -> None:
    assert problems(["001_a.sql", "001_b.sql", "notes.sql"]) == ["notes.sql", "duplicate 001"]
