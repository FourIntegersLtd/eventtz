#!/usr/bin/env python3
"""One-off import path migration for feature-first reorg."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app"

REPLACEMENTS: list[tuple[str, str]] = [
    ("from app.infrastructure.postgrest import", "from app.core.db import"),
    ("from app.infrastructure import postgrest", "from app.core import db as postgrest"),
    ("app.infrastructure.postgrest", "app.core.db"),
    ("from app.domain.errors import", "from app.core.errors import"),
    ("from app.domain import errors", "from app.core import errors"),
    ("from app.api.error_handlers import", "from app.core.errors import"),
    ("from app.supabase_client import", "from app.core.db import"),
    ("from app.services._vendor_common import get_client", "from app.core.db import get_db as get_client"),
    ("from app.services._vendor_common import get_db", "from app.core.db import get_db"),
    ("from app.services._vendor_common import local_vendors", "from app.core.db import local_vendors"),
    ("from app.services._vendor_common import is_missing_approval_status_column", "from app.core.db import is_missing_approval_status_column"),
    ("from app.services._vendor_common import is_approval_status_check_violation", "from app.core.db import is_approval_status_check_violation"),
    ("import app.services._vendor_common", "import app.core.db as _vendor_common"),
    ("from app.api.authz import", "from app.features.auth.http.guards import"),
    ("from app.api.deps import", "from app.features.auth.http.dependencies import"),
    ("from app.services.auth_session_service import", "from app.features.auth.session import"),
    ("from app.services import local_auth_store", "from app.features.auth import local_store as local_auth_store"),
    ("from app.services.local_auth_store import", "from app.features.auth.local_store import"),
    ("from app.services.supabase_auth import", "from app.features.auth.supabase import"),
    ("from app.services.user_account_service import", "from app.features.auth.accounts import"),
    ("from app.services.user_lookup import", "from app.features.auth.lookup import"),
    ("from app.repositories.user_repository import", "from app.features.auth.db_users import"),
    ("from app.repositories.vendor_repository import", "from app.features.auth.db_vendors import"),
    ("from app.repositories import user_repository", "from app.features.auth import db_users as user_repository"),
    ("from app.repositories import vendor_repository", "from app.features.auth import db_vendors as vendor_repository"),
    ("from app.services.chat_service import", "from app.features.chat.service import"),
    ("from app.api.v1.handlers import chat_handlers", "from app.features.chat.http import handlers as chat_handlers"),
    ("from app.api.v1.handlers.chat_handlers import", "from app.features.chat.http.handlers import"),
    ("from app.repositories.conversation_repository import", "from app.features.chat.db_conversations import"),
    ("from app.repositories.message_repository import", "from app.features.chat.db_messages import"),
    ("from app.services.booking.", "from app.features.bookings."),
    ("from app.services.booking import", "from app.features.bookings import"),
    ("from app.services.booking_payment_service import", "from app.features.bookings.payments import"),
    ("from app.services.booking_review_service import", "from app.features.bookings.reviews import"),
    ("from app.services.booking_pricing import", "from app.features.bookings.pricing import"),
    ("from app.services.dispute_service import", "from app.features.bookings.disputes import"),
    ("from app.services.dispute_case_commands import", "from app.features.bookings.dispute_commands import"),
    ("from app.services.booking_request_service import", "from app.features.bookings import"),
    ("from app.repositories.booking_repository import", "from app.features.bookings.db import"),
    ("from app.api.v1.handlers import dispute_handlers", "from app.features.bookings.http import disputes_http as dispute_handlers"),
    ("from app.api.v1.handlers.dispute_handlers import", "from app.features.bookings.http.disputes_http import"),
    ("from app.services.notification_service import", "from app.features.notifications.service import"),
    ("from app.api.v1.handlers import notification_handlers", "from app.features.notifications.http import handlers as notification_handlers"),
    ("from app.api.v1.handlers.notification_handlers import", "from app.features.notifications.http.handlers import"),
    ("from app.repositories.notification_repository import", "from app.features.notifications.db import"),
    ("from app.services.stripe_service import", "from app.features.payments.stripe import"),
    ("from app.services.vendor_profile_service import", "from app.features.vendors.profile import"),
    ("from app.services.vendor_search_service import", "from app.features.vendors.search import"),
    ("from app.services.vendor_moderation_service import", "from app.features.vendors.moderation import"),
    ("from app.services.vendor_onboarding_ai_service import", "from app.features.vendors.onboarding_ai import"),
    ("from app.services.admin.", "from app.features.admin."),
    ("from app.services.admin import", "from app.features.admin import"),
    ("from app.services.admin_audit_service import", "from app.features.admin.audit import"),
    ("from app.services.admin_ops_service import", "from app.features.admin import"),
    ("from app.services.uk_address_service import", "from app.features.geo.uk_address import"),
    ("from app.services.os_places_service import", "from app.features.geo.os_places import"),
    ("from app.services.getaddress_service import", "from app.features.geo.getaddress import"),
    ("from app.services.media_service import", "from app.features.media.upload import"),
    ("from app.services.realtime_service import", "from app.features.realtime.sse import"),
    ("from app.services.user_contact_service import", "from app.features.settings.contact import"),
    ("from app.schemas.domain import", "from app.contracts.types import"),
    ("from app.schemas.", "from app.contracts."),
]

SKIP_DIRS = {"__pycache__", "api", "services", "repositories", "infrastructure", "domain", "schemas"}


def migrate_file(path: Path) -> bool:
    text = path.read_text()
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text)
        return True
    return False


def main() -> None:
    changed = 0
    for path in ROOT.rglob("*.py"):
        parts = set(path.relative_to(ROOT).parts)
        if parts & SKIP_DIRS and "features" not in parts:
            continue
        if migrate_file(path):
            changed += 1
            print(f"updated: {path.relative_to(ROOT)}")
    print(f"done: {changed} files")


if __name__ == "__main__":
    main()
