"""Shared helpers for admin service modules."""

from __future__ import annotations

from typing import Any


def opt_admin_ts(v: Any) -> str | None:
    if v is None:
        return None
    return v if isinstance(v, str) else str(v)
