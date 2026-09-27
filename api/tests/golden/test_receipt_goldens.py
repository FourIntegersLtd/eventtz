"""Receipt HTML documents render exactly as the baseline's did (see `capture/receipt_goldens.py`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.features.bookings.service_receipts import render_receipt_html

DOCUMENTS = json.loads(
    (Path(__file__).parent / "receipts" / "receipt_documents.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", DOCUMENTS, ids=lambda case: case["id"])
def test_receipt_html_matches_baseline(case: dict[str, Any]) -> None:
    assert render_receipt_html(case["payload"]) == case["html"]
