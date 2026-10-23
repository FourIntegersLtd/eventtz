"""No source file works out "today" as a server-clock or UTC date; use `core.time.uk_today()` / `uk_date()`.

Eventtz is a UK marketplace, so a business day is the London calendar day. Between 00:00 and 01:00 BST,
`date.today()` (server zone) and `datetime.now(UTC).date()` still say yesterday. Banned outside
`core/time.py`: `date.today()`, `datetime.today()`, `datetime.utcnow()` and `.date()` called straight on
`datetime.now(...)` / `datetime.utcnow()` / `datetime.today()`. Timestamps (`datetime.now(UTC)` kept as a
moment) are fine. Docstrings and comments never parse as code, so prose may name these calls.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, parse, python_files, rel

ALLOWED_FILE = APP_ROOT / "core" / "time.py"
#: Files still counting UTC days after `astimezone(UTC).date()`. `domain_cancellation.days_before_event` sets
#: the refund tier, so money-owner moves it to `uk_date` separately with a golden check. Nothing else joins.
UTC_DAY_ALLOWED_FILES = {"app/features/bookings/domain_cancellation.py"}
SCANNED_FILES = [path for path in python_files(APP_ROOT) if path != ALLOWED_FILE]
#: `datetime.<name>()` clocks whose date part is a server-zone or UTC calendar day.
CLOCK_NAMES = {"now", "utcnow", "today"}


def _is_clock_call(node: ast.expr) -> bool:
    """True for `datetime.now(...)`, `datetime.utcnow()` or `datetime.today()`."""
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in CLOCK_NAMES
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "datetime"
    )


def _is_astimezone_utc(node: ast.expr) -> bool:
    """True for `<moment>.astimezone(UTC)` / `.astimezone(timezone.utc)`."""
    if not (
        isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "astimezone"
    ):
        return False
    if len(node.args) != 1:
        return False
    zone = node.args[0]
    return (isinstance(zone, ast.Name) and zone.id == "UTC") or (
        isinstance(zone, ast.Attribute) and zone.attr == "utc"
    )


def violations(path: Path) -> list[str]:
    """`file:line` of every server-clock or UTC calendar-day computation in `path`."""
    found: list[str] = []
    for node in ast.walk(parse(path)):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        owner = node.func.value
        if node.func.attr == "today" and isinstance(owner, ast.Name) and owner.id in {"date", "datetime"}:
            found.append(f"{rel(path)}:{node.lineno} calls {owner.id}.today(); use core.time.uk_today()")
        elif node.func.attr == "utcnow" and isinstance(owner, ast.Name) and owner.id == "datetime":
            found.append(f"{rel(path)}:{node.lineno} calls datetime.utcnow(); use core.time.uk_today()")
        elif node.func.attr == "date" and _is_astimezone_utc(owner):
            if rel(path) not in UTC_DAY_ALLOWED_FILES:
                found.append(
                    f"{rel(path)}:{node.lineno} takes .date() after astimezone(UTC); use core.time.uk_date()"
                )
        elif node.func.attr == "date" and _is_clock_call(owner):
            found.append(
                f"{rel(path)}:{node.lineno} takes .date() of a clock; use core.time.uk_today()/uk_date()"
            )
    return sorted(found, key=lambda finding: int(finding.split(" ")[0].rsplit(":", 1)[1]))


@pytest.mark.parametrize("path", SCANNED_FILES, ids=rel)
def test_business_days_come_from_core_time(path: Path) -> None:
    """Every scanned source file leaves the calendar day to `core.time`."""
    found = violations(path)
    assert not found, "\n".join(found)


def test_the_guard_would_catch_a_utc_or_server_zone_day(tmp_path: Path) -> None:
    """Each banned form is caught with its line; a kept timestamp and `uk_today()` pass."""
    planted = tmp_path / "planted.py"
    planted.write_text(
        "from datetime import UTC, date, datetime\n"
        "first = date.today()\n"
        "second = datetime.now(UTC).date()\n"
        "third = datetime.utcnow().date()\n"
        "fourth = datetime.today()\n"
        "fifth = datetime.utcnow()\n"
        "moment = datetime.now(UTC)\n"
        "sixth = moment.astimezone(UTC).date()\n"
        "seventh = moment.astimezone(timezone.utc).date()\n"
        "fine = uk_today()\n",
        encoding="utf-8",
    )
    assert [finding.split(" ")[0] for finding in violations(planted)] == [
        "planted.py:2",
        "planted.py:3",
        "planted.py:4",
        "planted.py:4",
        "planted.py:5",
        "planted.py:6",
        "planted.py:8",
        "planted.py:9",
    ]
