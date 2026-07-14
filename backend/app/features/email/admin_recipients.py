"""Resolve admin notification email recipients."""

from __future__ import annotations

from app.features.email.constants import ADMIN_NOTIFY_RECIPIENTS


def admin_notify_recipients() -> list[str]:
    return list(ADMIN_NOTIFY_RECIPIENTS)
