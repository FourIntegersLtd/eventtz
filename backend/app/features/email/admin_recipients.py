"""Resolve admin notification email recipients."""

from __future__ import annotations

from app.core.config import get_settings


def admin_notify_recipients() -> list[str]:
    return get_settings().admin_notify_emails_list
