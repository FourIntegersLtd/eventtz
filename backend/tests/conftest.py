"""Test-suite defaults applied before any app module is imported."""

from __future__ import annotations

import os

# A developer's backend/.env normally holds a real SENTRY_DSN, and importing the
# app initializes Sentry, so local test runs would ship noise to the live project.
os.environ["SENTRY_DSN"] = ""

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()
