"""Migrations in `backend/sql/` have unique three-digit numbers (the shared DB's one history)."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from tests.guards._scan import SQL_ROOT

PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")


def problems(files: list[str]) -> list[str]:
    bad = [f for f in files if not PATTERN.match(f)]
    numbers = Counter(m.group(1) for f in files if (m := PATTERN.match(f)))
    bad += [f"duplicate {n}" for n, count in sorted(numbers.items()) if count > 1]
    return bad


def test_migrations_are_uniquely_numbered() -> None:
    files = sorted(p.name for p in SQL_ROOT.glob("*.sql"))
    assert files, f"no migrations found in {SQL_ROOT}"
    assert problems(files) == []


def test_the_guard_would_catch_a_duplicate(tmp_path: Path) -> None:
    assert problems(["001_a.sql", "001_b.sql", "notes.sql"]) == ["notes.sql", "duplicate 001"]
