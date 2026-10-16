"""The admin console end to end over HTTP: team, clients, audit log and test email.

Complements `acceptance/test_admin_team.py` (which proves parity with the
baseline, driven at the same server both `backend/` and `api/` answer). These
tests prove the pieces that suite cannot see from outside the process: the
audit rows a mutation actually writes, and the one-click setup link a fake
mailer actually receives. Every request carries a real Bearer token minted by
`make_actor`, so role checks run through the same code path production does.
"""

from __future__ import annotations

import re

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_access_token
from app.core.ports import mailer_port
from app.core.settings import get_settings
from app.features.identity import repository as identity_repository
from tests.conftest import MakeActor
from tests.support.fakes import FakeMailer

pytestmark = [pytest.mark.db, pytest.mark.e2e]


@pytest.fixture
def mailer(app: FastAPI) -> FakeMailer:
    """The fake mailer every request in the test sends through."""
    fake = FakeMailer()
    app.dependency_overrides[mailer_port] = lambda: fake
    return fake


def link_token(mailer: FakeMailer) -> str:
    """The one-click token in the last email's link."""
    found = re.search(r"token=([^\"&\s<]+)", mailer.sent[-1].html)
    assert found, "the email carries no link"
    return found.group(1)


async def auth(make_actor: MakeActor, **kwargs: object) -> dict[str, str]:
    """A Bearer header for a freshly minted account."""
    token = await make_actor(**kwargs)  # type: ignore[arg-type]
    return {"Authorization": f"Bearer {token}"}


async def test_inviting_a_new_admin_without_a_password_sends_a_setup_link(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")

    invited = await client.post(
        "/api/v1/admin/team/invite", json={"email": "new-admin@example.com"}, headers=headers
    )
    assert invited.status_code == 200, invited.text
    body = invited.json()
    assert (body["created"], body["invite_link_sent"], body["admin_role"]) == (True, True, "admin")

    assert mailer.sent, "no setup-link email was sent"
    assert mailer.sent[-1].to == ("new-admin@example.com",)
    assert link_token(mailer)  # a token really is embedded in the email


async def test_inviting_with_a_password_sends_no_link_but_still_welcomes_the_new_admin(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")

    invited = await client.post(
        "/api/v1/admin/team/invite",
        json={"email": "with-password@example.com", "password": "Correct-horse-9battery"},
        headers=headers,
    )
    assert invited.status_code == 200, invited.text
    assert invited.json()["invite_link_sent"] is False
    # No one-click link (a password was set): the team invite, then the admin welcome, as on the baseline.
    assert [(email.to, email.subject) for email in mailer.sent] == [
        (("with-password@example.com",), "Eventtz admin invite | Eventtz"),
        (("with-password@example.com",), "Welcome to Eventtz admin | Eventtz"),
    ]
    assert all("token=" not in email.html for email in mailer.sent)

    signed_in = await client.post(
        "/api/v1/auth/signin",
        json={"email": "with-password@example.com", "password": "Correct-horse-9battery"},
    )
    assert signed_in.status_code == 200, signed_in.text


async def test_promoting_a_client_with_a_password_sends_only_the_team_invite(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")
    await make_actor(email="existing-client@example.com", user_type="client")

    promoted = await client.post(
        "/api/v1/admin/team/invite",
        json={"email": "existing-client@example.com", "password": "Correct-horse-9battery"},
        headers=headers,
    )
    assert promoted.status_code == 200, promoted.text
    assert (promoted.json()["created"], promoted.json()["invite_link_sent"]) == (False, False)
    assert [(email.to, email.subject) for email in mailer.sent] == [
        (("existing-client@example.com",), "Eventtz admin invite | Eventtz"),
    ]


async def test_a_plain_admin_cannot_invite(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="plain-admin@example.com", user_type="admin", admin_role="admin")

    refused = await client.post(
        "/api/v1/admin/team/invite", json={"email": "nope@example.com"}, headers=headers
    )
    assert (refused.status_code, refused.json()["code"]) == (403, "super_admin_only")
    assert not mailer.sent


async def test_deleting_a_team_member_writes_an_audit_entry(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")
    other_id = await identity_repository.create_account(
        db_session, email="second-admin@example.com", user_type="admin", admin_role="admin"
    )
    assert other_id is not None

    deleted = await client.delete(f"/api/v1/admin/team/{other_id}", headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {
        "success": True,
        "user_id": other_id,
        "email": "second-admin@example.com",
        "deleted": True,
        "demoted_to": None,
        "message": "Admin account deleted.",
    }

    audit = await client.get("/api/v1/admin/audit-log?category=team", headers=headers)
    assert audit.status_code == 200, audit.text
    entries = audit.json()["entries"]
    assert entries and entries[0]["action"] == "admin.team_delete"
    assert entries[0]["entity_id"] == other_id
    assert entries[0]["audit_event_details"] == {
        "email": "second-admin@example.com",
        "deleted": True,
        "demoted_to": None,
    }

    detail = await client.get(f"/api/v1/admin/audit-log/{entries[0]['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["entry"]["id"] == entries[0]["id"]


async def test_deleting_the_last_super_admin_is_refused(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, mailer: FakeMailer
) -> None:
    token = await make_actor(email="super@example.com", user_type="admin", admin_role="super_admin")
    headers = {"Authorization": f"Bearer {token}"}
    # The token's `sub` is this account's id; read it back to target a self-delete.
    from app.core.auth import decode_access_token  # noqa: PLC0415
    from app.core.settings import get_settings  # noqa: PLC0415

    claims = decode_access_token(token, settings=get_settings())
    assert claims is not None

    self_delete = await client.delete(f"/api/v1/admin/team/{claims.user_id}", headers=headers)
    assert (self_delete.status_code, self_delete.json()["code"]) == (400, "cannot_delete_self")


async def test_suspending_a_client_round_trips(
    client: AsyncClient, make_actor: MakeActor, db_session: AsyncSession, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")
    client_id = await identity_repository.create_account(
        db_session, email="a-client@example.com", user_type="client"
    )
    assert client_id is not None

    listed = await client.get("/api/v1/admin/clients?q=a-client", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["clients"][0]["account_suspended"] is False

    suspended = await client.patch(
        f"/api/v1/admin/clients/{client_id}/suspended", json={"suspended": True}, headers=headers
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json() == {"success": True}

    relisted = await client.get("/api/v1/admin/clients?q=a-client", headers=headers)
    assert relisted.json()["clients"][0]["account_suspended"] is True


async def test_sending_a_test_email(client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")

    templates = await client.get("/api/v1/admin/email/templates", headers=headers)
    assert templates.status_code == 200, templates.text
    template_id = templates.json()["templates"][0]["id"]

    sent = await client.post(
        "/api/v1/admin/email/test-send",
        json={"template_id": template_id, "to_email": "qa@example.com"},
        headers=headers,
    )
    assert sent.status_code == 200, sent.text
    assert sent.json() == {"success": True, "delivered": True, "message": None}
    assert mailer.sent[-1].to == ("qa@example.com",)

    audit = await client.get("/api/v1/admin/audit-log?category=all", headers=headers)
    actions = [entry["action"] for entry in audit.json()["entries"]]
    assert "email.test_send" in actions


async def test_an_unknown_template_id_is_refused(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="super@example.com", user_type="admin", admin_role="super_admin")

    refused = await client.post(
        "/api/v1/admin/email/test-send",
        json={"template_id": "not-a-real-template", "to_email": "qa@example.com"},
        headers=headers,
    )
    assert (refused.status_code, refused.json()["code"]) == (400, "unknown_email_template")


async def test_suspending_a_client_emails_them_once_and_restoring_sends_nothing(
    client: AsyncClient, make_actor: MakeActor, mailer: FakeMailer
) -> None:
    headers = await auth(make_actor, email="staff@example.com", user_type="admin", admin_role="admin")
    client_token = await make_actor("suspendme@example.com")
    client_id = decode_access_token(client_token, settings=get_settings()).user_id  # type: ignore[union-attr]
    path = f"/api/v1/admin/clients/{client_id}/suspended"

    suspended = await client.patch(path, json={"suspended": True}, headers=headers)
    assert suspended.status_code == 200, suspended.text
    assert [(email.to, email.subject) for email in mailer.sent] == [
        (("suspendme@example.com",), "Account suspended | Eventtz")
    ]

    restored = await client.patch(path, json={"suspended": False}, headers=headers)
    assert restored.status_code == 200, restored.text
    assert len(mailer.sent) == 1  # restoring sends nothing


async def test_a_failing_mailer_does_not_stop_a_suspension(
    client: AsyncClient, make_actor: MakeActor, app: FastAPI
) -> None:
    class ExplodingMailer:
        """A provider that raises instead of answering."""

        def send(self, email: object) -> bool:
            """Always fail."""
            raise RuntimeError("provider down")

    app.dependency_overrides[mailer_port] = lambda: ExplodingMailer()
    headers = await auth(make_actor, email="staff@example.com", user_type="admin", admin_role="admin")
    client_token = await make_actor("suspendme@example.com")
    client_id = decode_access_token(client_token, settings=get_settings()).user_id  # type: ignore[union-attr]

    suspended = await client.patch(
        f"/api/v1/admin/clients/{client_id}/suspended", json={"suspended": True}, headers=headers
    )
    assert suspended.status_code == 200, suspended.text
    listed = await client.get("/api/v1/admin/clients", headers=headers)
    assert listed.json()["clients"][0]["account_suspended"] is True
