"""Turning a database row into JSON and back without losing precision.

`export.py` writes each row psycopg hands back as one JSON array (column order
comes from a manifest written alongside, not repeated per row). The only values
JSON cannot represent as-is are `Decimal`, `UUID`, `date` and `datetime`; each
becomes a string that Postgres parses back to the exact original value when it
arrives as a text-mode parameter to an `INSERT` (`load.py`), because the
target column's own type tells Postgres how to read it. Converting `Decimal` to
`float` anywhere in this round trip would be the exact bug AGENTS.md warns
about for money columns, so it never happens here.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID


def to_jsonable(value: Any) -> Any:
    """One column value, converted only if `json.dumps` cannot already write it."""
    if isinstance(value, Decimal | UUID):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, memoryview | bytes):
        return bytes(value).hex()
    return value


def row_to_json_line(values: tuple[Any, ...]) -> str:
    """One exported row as a single line of JSON (a bare array, no column names)."""
    return json.dumps([to_jsonable(value) for value in values])


def json_line_to_row(line: str) -> list[Any]:
    """A previously exported line, back to plain Python values ready to bind as query params.

    Every value stays a string, `int`, `float`, `bool` or `None`; `load.py`
    binds them straight into a parameterised `INSERT`, and Postgres reads each
    one back using the *target* column's type, not any type recorded here.
    """
    result: list[Any] = json.loads(line)
    return result
