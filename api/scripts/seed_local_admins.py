"""Seed fixed local admin logins for browser checks (compose Postgres only).

Creates or updates:
- admin@example.com (admin_role ``admin``)
- superadmin@example.com (admin_role ``super_admin``)

Both use password ``LocalAdmin123!`` (argon2 via the identity slice). Refuses
non-local database hosts, matching ``acceptance/conftest.py`` ``LOCAL_HOSTS``.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from urllib.parse import urlparse

from app.core.db import dispose_engine, job_session
from app.core.settings import get_settings
from app.features.identity import repository
from app.features.identity.domain_accounts import normalise_email
from app.features.identity.service_staff_accounts import set_account_password
from app.features.identity.tokens import hash_password

LOCAL_HOSTS = frozenset({"127.0.0.1", "localhost"})
PASSWORD = "LocalAdmin123!"  # noqa: S105 — local compose seed only; documented in the module docstring

ADMINS = (
    ("admin@example.com", "admin"),
    ("superadmin@example.com", "super_admin"),
)


def _database_host(database_url: str) -> str | None:
    """Hostname from a SQLAlchemy/psycopg URL."""
    url = database_url
    if url.startswith("postgresql+psycopg://"):
        url = "postgresql://" + url[len("postgresql+psycopg://") :]
    return urlparse(url).hostname


def _require_local_database() -> None:
    host = _database_host(get_settings().database_url)
    if host not in LOCAL_HOSTS:
        sys.stderr.write(
            "seed_local_admins only runs against a local compose database (127.0.0.1 or localhost).\n"
        )
        raise SystemExit(1)


async def _upsert_admin(email: str, admin_role: str) -> None:
    normalised = normalise_email(email)
    now = datetime.now(UTC)
    async with job_session() as session:
        profile = await repository.find_profile_by_email(session, normalised)
        if profile is None:
            user_id = await repository.create_account(
                session,
                email=normalised,
                user_type="admin",
                password_hash=hash_password(PASSWORD),
                admin_role=admin_role,
                email_verified_at=now,
            )
            if user_id is None:
                raise RuntimeError(f"Could not create {email}: address already taken.")
            return
        await repository.update_profile(
            session,
            profile.id,
            {
                "user_type": "admin",
                "admin_role": admin_role,
                "email_verified_at": now,
                "account_suspended": False,
                "deleted_at": None,
            },
        )
        await set_account_password(session, profile.id, PASSWORD)


async def _main() -> None:
    _require_local_database()
    for email, role in ADMINS:
        await _upsert_admin(email, role)
    await dispose_engine()
    for email, _role in ADMINS:
        sys.stdout.write(f"{email}\n")


if __name__ == "__main__":
    asyncio.run(_main())
