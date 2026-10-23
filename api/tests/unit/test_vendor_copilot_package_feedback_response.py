"""Pins the exact JSON of `POST /vendor/copilot/review-packages`' `package_feedback` rows."""

from __future__ import annotations

import json

import pytest

from app.features.copilot.service_packages import review_listing_packages
from tests.support.fakes import FakeLanguageModel


@pytest.mark.asyncio
async def test_package_feedback_rows_keep_every_key_including_nulls() -> None:
    """A row the model gave no rewrite for still carries its null `suggested_*` keys."""
    language_model = FakeLanguageModel(
        reply={
            "overall_ok": False,
            "summary": "  ",
            "package_feedback": [
                {"package_id": "p1", "package_title": "Gold", "items": ["Add a duration"]},
                {
                    "package_title": "Silver",
                    "suggested_title": "Silver DJ set",
                    "suggested_details": "Four hours of music.",
                    "suggested_duration": "4 hours",
                },
            ],
        }
    )
    response = await review_listing_packages(payload={}, language_model=language_model)
    assert json.dumps(response.model_dump(mode="json"), separators=(",", ":")) == (
        '{"overall_ok":true,"summary":"Here are a few ways to make your packages easier to book.",'
        '"package_feedback":[{"package_id":"p1","package_title":"Gold","items":["Add a duration"],'
        '"suggested_title":null,"suggested_details":null,"suggested_duration":null},'
        '{"package_id":null,"package_title":"Silver","items":[],"suggested_title":"Silver DJ set",'
        '"suggested_details":"Four hours of music.","suggested_duration":"4 hours"}]}'
    )
