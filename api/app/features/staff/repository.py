"""Database access for the staff slice: the `admin_audit_log` table (owned here), plus the
`users` and `booking_requests` tables it reads and writes directly for the team and client
consoles.

`users` and `booking_requests` are owned by the identity and bookings slices, whose ORM
models a slice may not import (the cross-slice guard only allows `service*`/`schemas`/
`errors`/`jobs`). Reading and writing them here through a `sqlalchemy.table()` handle is the
same pattern `bookings/repository_admin.py` uses for `dispute_cases` and `vendors`.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, DateTime, Text, Uuid, column, delete, exists, func, or_, select, table, update
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row, plain_value
from app.features.staff.models import AdminAuditLog
from app.features.staff.rows import AdminAuditLogRow, AdminClientRow, AdminTeamMemberRow

# --- table handles for other slices' tables (see module docstring) ---------------------------------

# `users.user_type` is a Postgres ENUM (created by the baseline schema, named identically
# in the identity slice's own model); this table() handle must use the same type or every
# comparison against it fails at the database with "operator does not exist".
_USER_TYPE = ENUM("client", "vendor", "admin", name="user_type", create_type=False)

_users = table(
    "users",
    column("id", Uuid),
    column("email", Text),
    column("user_type", _USER_TYPE),
    column("admin_role", Text),
    column("account_suspended", Boolean),
    column("created_at", DateTime(timezone=True)),
)

_booking_requests = table("booking_requests", column("client_user_id", Uuid), column("vendor_user_id", Uuid))
_booking_reviews = table("booking_reviews", column("client_user_id", Uuid), column("vendor_user_id", Uuid))
_conversations = table("conversations", column("client_user_id", Uuid), column("vendor_user_id", Uuid))
_dispute_cases = table("dispute_cases", column("opened_by_user_id", Uuid))
_vendors = table("vendors", column("user_id", Uuid))

_TEAM_COLUMNS = (
    _users.c.id,
    _users.c.email,
    _users.c.admin_role,
    _users.c.created_at,
    _users.c.account_suspended,
)


def _team_row(mapping: dict[str, Any]) -> AdminTeamMemberRow:
    """One `users` row, in the shape the team console reads."""
    return AdminTeamMemberRow(
        id=str(mapping["id"]),
        email=mapping.get("email"),
        admin_role=mapping.get("admin_role"),
        created_at=mapping.get("created_at"),
        account_suspended=bool(mapping.get("account_suspended")),
    )


async def list_admin_team(session: AsyncSession) -> list[AdminTeamMemberRow]:
    """Every admin account, oldest first (the baseline's order)."""
    result = await session.execute(
        select(*_TEAM_COLUMNS).where(_users.c.user_type == "admin").order_by(_users.c.created_at.asc())
    )
    return [_team_row(plain_row(found)) for found in result]


async def find_admin_by_id(session: AsyncSession, user_id: str) -> AdminTeamMemberRow | None:
    """One admin account by id, or `None` if it does not exist or is not an admin."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return None
    result = await session.execute(
        select(*_TEAM_COLUMNS).where(_users.c.id == account_id, _users.c.user_type == "admin")
    )
    found = result.first()
    return _team_row(plain_row(found)) if found is not None else None


async def count_other_super_admins(session: AsyncSession, *, excluding_user_id: str) -> int:
    """How many admin accounts other than `excluding_user_id` are super admins.

    Used only for the "last super admin" guard rails, which the acceptance
    freeze does not exercise (see `acceptance/test_admin_team.py`'s module
    docstring); kept because a real team console must never strand itself
    with zero super admins.
    """
    excluded = as_uuid(excluding_user_id)
    result = await session.execute(
        select(func.count())
        .select_from(_users)
        .where(_users.c.user_type == "admin", _users.c.admin_role == "super_admin", _users.c.id != excluded)
    )
    return int(result.scalar_one())


async def patch_admin(
    session: AsyncSession, user_id: str, changes: dict[str, Any]
) -> AdminTeamMemberRow | None:
    """Apply `changes` (column name to value) to one admin's `users` row; `None` if it did not match."""
    account_id = as_uuid(user_id)
    if account_id is None or not changes:
        return None
    result = await session.execute(
        update(_users).where(_users.c.id == account_id, _users.c.user_type == "admin").values(**changes)
    )
    if result.rowcount != 1:  # type: ignore[attr-defined]
        return None
    return await find_admin_by_id(session, user_id)


async def demote_admin(session: AsyncSession, user_id: str, *, user_type: str) -> None:
    """Turn an admin account back into a plain client/vendor account (used instead of a delete
    that would otherwise violate a foreign key)."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return
    await session.execute(
        update(_users)
        .where(_users.c.id == account_id)
        .values(user_type=user_type, admin_role=None, account_suspended=False)
    )


async def hard_delete_user(session: AsyncSession, user_id: str) -> None:
    """Remove the `users` row outright. Only safe to call once nothing else references it."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return
    await session.execute(delete(_users).where(_users.c.id == account_id))


async def has_vendor_profile(session: AsyncSession, user_id: str) -> bool:
    """True when this account also has a `vendors` row (mirrors the baseline's `_has_vendor_profile`)."""
    account_id = as_uuid(user_id)
    result = await session.execute(select(exists().where(_vendors.c.user_id == account_id)))
    return bool(result.scalar())


async def has_client_or_restricted_activity(session: AsyncSession, user_id: str) -> bool:
    """True when a booking, review, conversation or dispute this account opened would block a
    hard delete (mirrors the baseline's `_has_client_activity` / `_has_restricted_public_references`,
    against the RESTRICT foreign keys in `alembic/sql/0002_baseline_schema.sql`)."""
    account_id = as_uuid(user_id)
    checks = (
        select(exists().where(_booking_requests.c.client_user_id == account_id)),
        select(exists().where(_booking_requests.c.vendor_user_id == account_id)),
        select(exists().where(_booking_reviews.c.client_user_id == account_id)),
        select(exists().where(_booking_reviews.c.vendor_user_id == account_id)),
        select(exists().where(_conversations.c.client_user_id == account_id)),
        select(exists().where(_conversations.c.vendor_user_id == account_id)),
        select(exists().where(_dispute_cases.c.opened_by_user_id == account_id)),
    )
    for check in checks:
        if bool((await session.execute(check)).scalar()):
            return True
    return False


# --- clients ----------------------------------------------------------------------------------------


async def _booking_counts_by_client(session: AsyncSession, client_ids: list[str]) -> dict[str, int]:
    """How many booking requests each of these clients has made, in one query."""
    client_uuids = [parsed for parsed in (as_uuid(client_id) for client_id in client_ids) if parsed]
    if not client_uuids:
        return {}
    result = await session.execute(
        select(_booking_requests.c.client_user_id, func.count())
        .where(_booking_requests.c.client_user_id.in_(client_uuids))
        .group_by(_booking_requests.c.client_user_id)
    )
    return {str(client_id): count for client_id, count in result}


async def list_clients(
    session: AsyncSession, *, offset: int, limit: int, search_email: str | None, suspended: bool | None
) -> tuple[list[AdminClientRow], int]:
    """A page of client accounts, most recently created first, with each one's booking count."""
    conditions: list[Any] = [_users.c.user_type == "client"]
    search_term = (search_email or "").strip()
    if search_term:
        conditions.append(_users.c.email.ilike(f"%{search_term}%"))
    if suspended is not None:
        conditions.append(_users.c.account_suspended == suspended)
    count_result = await session.execute(select(func.count()).select_from(_users).where(*conditions))
    total = int(count_result.scalar_one())
    result = await session.execute(
        select(_users.c.id, _users.c.email, _users.c.created_at, _users.c.account_suspended)
        .where(*conditions)
        .order_by(_users.c.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = [plain_row(found) for found in result]
    counts = await _booking_counts_by_client(session, [str(row["id"]) for row in rows])
    return [
        AdminClientRow(
            user_id=str(row["id"]),
            email=row.get("email"),
            created_at=row.get("created_at"),
            account_suspended=bool(row.get("account_suspended")),
            booking_count=counts.get(str(row["id"]), 0),
        )
        for row in rows
    ], total


async def set_client_suspended(session: AsyncSession, user_id: str, *, suspended: bool) -> bool:
    """Suspend or unsuspend one client account. Returns whether a row matched."""
    account_id = as_uuid(user_id)
    if account_id is None:
        return False
    result = await session.execute(
        update(_users)
        .where(_users.c.id == account_id, _users.c.user_type == "client")
        .values(account_suspended=suspended)
    )
    return bool(result.rowcount == 1)  # type: ignore[attr-defined]


# --- audit log ----------------------------------------------------------------------------------------

# Category filters match the frontend's `auditFormatters` `CATEGORY_BY_ACTION` (baseline `audit.py`).
_CATEGORY_PREFIXES: dict[str, tuple[str, ...]] = {
    "bookings": ("booking.",),
    "clients": ("client.",),
    "vendors": ("vendor.",),
    "disputes": ("dispute.",),
    "reviews": ("review.",),
    "chat": ("chat.",),
    "financials": ("financials.",),
    "team": ("admin.team",),
}


def _audit_row(entry: AdminAuditLog) -> AdminAuditLogRow:
    """One `admin_audit_log` row, in the shape the audit-log screens read."""
    return AdminAuditLogRow(
        id=str(entry.id),
        admin_user_id=str(entry.admin_user_id) if entry.admin_user_id else None,
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        audit_event_details=entry.payload or {},
        created_at=plain_value(entry.created_at),
    )


async def list_audit_log(
    session: AsyncSession, *, offset: int, limit: int, category: str
) -> tuple[list[AdminAuditLogRow], int]:
    """A page of audit entries, most recent first, optionally narrowed to one category.

    An unrecognised category answers empty, like the baseline.
    """
    normalised_category = (category or "all").strip().lower()
    prefixes = _CATEGORY_PREFIXES.get(normalised_category)
    conditions: list[Any] = []
    if prefixes:
        conditions.append(or_(*(AdminAuditLog.action.like(f"{prefix}%") for prefix in prefixes)))
    elif normalised_category not in ("", "all"):
        return [], 0
    count_result = await session.execute(select(func.count()).select_from(AdminAuditLog).where(*conditions))
    total = int(count_result.scalar_one())
    result = await session.execute(
        select(AdminAuditLog)
        .where(*conditions)
        .order_by(AdminAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_audit_row(entry) for entry in result.scalars().all()], total


async def get_audit_log_entry(session: AsyncSession, entry_id: str) -> AdminAuditLogRow | None:
    """One audit entry by id, or `None`."""
    entry_uuid = as_uuid(entry_id)
    if entry_uuid is None:
        return None
    entry = await session.get(AdminAuditLog, entry_uuid)
    return _audit_row(entry) if entry is not None else None


async def insert_audit_event(
    session: AsyncSession,
    *,
    admin_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict[str, Any],
) -> None:
    """Append one row to `admin_audit_log`; `details` is stored in the `payload` column.

    Written inside a savepoint: a failed audit insert must not poison the
    request's transaction, because the action it records has already happened.
    """
    async with session.begin_nested():
        session.add(
            AdminAuditLog(
                admin_user_id=uuid.UUID(admin_user_id),
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                payload=details,
            )
        )
