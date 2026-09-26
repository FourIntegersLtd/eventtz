"""Errors the admin insights slice raises."""

from __future__ import annotations

from app.core.errors import InvalidInput


class InvalidDateFilter(InvalidInput):
    """A `from_date`/`to_date` query value is not a `YYYY-MM-DD` date."""

    code = "invalid_date_filter"
    default_message = "Invalid date. Use YYYY-MM-DD."
