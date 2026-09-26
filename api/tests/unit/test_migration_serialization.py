"""`app.migration.serialization`: JSON round trip for a row, exact for money and ids."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from app.migration.serialization import json_line_to_row, row_to_json_line, to_jsonable


def test_to_jsonable_keeps_a_decimal_as_an_exact_string() -> None:
    # A float round trip of this value comes back as 12.34000000000000341...; the whole point of
    # keeping money exact is that a string never does that.
    assert to_jsonable(Decimal("12.34")) == "12.34"


def test_to_jsonable_turns_a_uuid_into_its_text_form() -> None:
    value = UUID("12345678-1234-5678-1234-567812345678")
    assert to_jsonable(value) == "12345678-1234-5678-1234-567812345678"


def test_to_jsonable_turns_a_datetime_into_isoformat() -> None:
    value = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
    assert to_jsonable(value) == "2026-01-02T03:04:05+00:00"


def test_to_jsonable_leaves_plain_values_alone() -> None:
    assert to_jsonable(None) is None
    assert to_jsonable(True) is True
    assert to_jsonable(42) == 42
    assert to_jsonable("hello") == "hello"


def test_row_round_trips_through_a_json_line() -> None:
    row_id = UUID("12345678-1234-5678-1234-567812345678")
    amount = Decimal("199.99")
    created = datetime(2026, 3, 4, 5, 6, 7, tzinfo=UTC)
    line = row_to_json_line((row_id, "client@example.com", amount, created, None, True))
    assert json_line_to_row(line) == [
        "12345678-1234-5678-1234-567812345678",
        "client@example.com",
        "199.99",
        "2026-03-04T05:06:07+00:00",
        None,
        True,
    ]
