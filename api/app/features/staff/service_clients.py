"""Use cases behind `/admin/clients*`: the client directory and suspend/unsuspend toggle.

Mirrors `backend/app/features/admin/client_admin_commands.py`, including the
"account suspended" email sent when (and only when) a client is suspended.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.notifications import service as notifications
from app.features.staff import repository
from app.features.staff.schemas import AdminClientRow, AdminClientsListResponse, SuccessResponse

log = get_logger(__name__)


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


async def set_suspended(
    session: AsyncSession, mailer: Mailer, user_id: str, *, suspended: bool
) -> SuccessResponse:
    """Suspend or restore one client account; suspending also emails them (restoring does not).

    A failed email is only logged: the suspension itself must still succeed.
    """
    email = await repository.get_client_email(session, user_id)
    await repository.set_client_suspended(session, user_id, suspended=suspended)
    if suspended:
        try:
            notifications.send_client_suspended_email(mailer, to=email)
        except Exception:
            log.warning("client suspended email failed user=%s", user_id, exc_info=True)
    return SuccessResponse()
