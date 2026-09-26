"""In-app booking notices read exactly as the baseline's did (captured by `booking_copy_goldens.py`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.notifications.domain_booking_copy import format_booking_notification

CASES = json.loads(
    (Path(__file__).parent / "notifications" / "booking_copy.json").read_text(encoding="utf-8")
)


def _case_id(case: dict[str, Any]) -> str:
    """A readable test id: kind, portal and which variants are set."""
    given = case["input"]
    return f"{given['kind']}-{given['portal']}-{given['event_name']!r}-{given['stored_body']!r}"


@pytest.mark.parametrize("case", CASES, ids=_case_id)
def test_booking_copy_matches_baseline(case: dict[str, Any]) -> None:
    given = case["input"]
    assert format_booking_notification(
        kind=given["kind"],
        portal=given["portal"],
        event_name=given["event_name"],
        stored_body=given["stored_body"],
    ) == (case["title"], case["body"])
