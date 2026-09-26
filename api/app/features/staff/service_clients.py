"""Use cases behind `/admin/clients*`: the client directory and suspend/unsuspend toggle.

Mirrors `backend/app/features/admin/client_admin_commands.py`. The baseline also
emails the client when they are suspended; the acceptance freeze does not
exercise that email, so it is left for a follow-up rather than guessed at here
(Laziness protocol: no code without a caller that needs it).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.staff import repository
from app.features.staff.schemas import AdminClientRow, AdminClientsListResponse, SuccessResponse


async def list_clients(
    session: AsyncSession, *, offset: int, limit: int, search_email: str | None, suspended: bool | None
) -> AdminClientsListResponse:
    """A page of the client directory, optionally filtered by email search or suspension."""
    rows, total = await repository.list_clients(
        session, offset=offset, limit=limit, search_email=search_email, suspended=suspended
    )
    clients = [
        AdminClientRow(
            user_id=row.user_id,
            email=row.email,
            created_at=row.created_at,
            account_suspended=row.account_suspended,
            booking_count=row.booking_count,
        )
        for row in rows
    ]
    return AdminClientsListResponse(clients=clients, total=total, offset=offset, limit=limit)


async def set_suspended(session: AsyncSession, user_id: str, *, suspended: bool) -> SuccessResponse:
    """Suspend or restore one client account."""
    await repository.set_client_suspended(session, user_id, suspended=suspended)
    return SuccessResponse()
