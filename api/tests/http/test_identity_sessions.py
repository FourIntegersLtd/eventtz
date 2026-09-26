"""Sign-in end to end over HTTP against the migrated Postgres (ADR 0003).

Proves the pieces the unit tests cannot: Alembic's schema, one transaction per
request, Bearer tokens, refresh-chain rotation and reuse detection (which must
survive its own error response), and the bcrypt → argon2 upgrade at sign-in.
"""

from __future__ import annotations

import re

import bcrypt
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import mailer_port
from app.features.identity import repository
from tests.support.fakes import FakeMailer

pytestmark = [pytest.mark.db, pytest.mark.e2e]

PASSWORD = "Correct-horse-9battery"
EMAIL = "ada@example.com"


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


async def signed_up_and_verified(client: AsyncClient, mailer: FakeMailer) -> None:
    """Create a client account and follow its verification link."""
    signup = await client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    assert signup.status_code == 200, signup.text
    assert signup.json()["session"] is None
    verified = await client.post("/api/v1/auth/verify-email", json={"token": link_token(mailer)})
    assert verified.status_code == 200, verified.text


async def test_an_unverified_client_cannot_sign_in(client: AsyncClient, mailer: FakeMailer) -> None:
    await client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    refused = await client.post("/api/v1/auth/signin", json={"email": EMAIL, "password": PASSWORD})
    assert (refused.status_code, refused.json()["code"]) == (403, "email_not_verified")
    assert mailer.sent[0].to == (EMAIL,)


async def test_sign_in_refresh_and_sign_out(client: AsyncClient, mailer: FakeMailer) -> None:
    await signed_up_and_verified(client, mailer)

    signed_in = await client.post("/api/v1/auth/signin", json={"email": EMAIL, "password": PASSWORD})
    assert signed_in.status_code == 200, signed_in.text
    assert "set-cookie" not in signed_in.headers
    first = signed_in.json()["session"]

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {first['access_token']}"})
    assert (me.status_code, me.json()["user"]["email"]) == (200, EMAIL)

    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert refreshed.status_code == 200, refreshed.text
    second = refreshed.json()["session"]
    assert second["refresh_token"] != first["refresh_token"]

    signed_out = await client.post("/api/v1/auth/signout", json={"refresh_token": second["refresh_token"]})
    assert signed_out.status_code == 200, signed_out.text
    after = await client.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert (after.status_code, after.json()["code"]) == (401, "session_expired")


async def test_a_reused_refresh_token_ends_the_whole_chain(client: AsyncClient, mailer: FakeMailer) -> None:
    """The thief's rotated token dies too, and the revocation survives the 401 it answers with."""
    await signed_up_and_verified(client, mailer)
    signed_in = await client.post("/api/v1/auth/signin", json={"email": EMAIL, "password": PASSWORD})
    spent = signed_in.json()["session"]["refresh_token"]
    successor = (await client.post("/api/v1/auth/refresh", json={"refresh_token": spent})).json()["session"]

    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": spent})
    assert (reused.status_code, reused.json()["code"]) == (401, "refresh_token_reused")
    after = await client.post("/api/v1/auth/refresh", json={"refresh_token": successor["refresh_token"]})
    assert (after.status_code, after.json()["code"]) == (401, "session_expired")


async def test_an_imported_bcrypt_password_signs_in_and_becomes_argon2(
    client: AsyncClient, mailer: FakeMailer, db_session: AsyncSession
) -> None:
    await signed_up_and_verified(client, mailer)
    profile = await repository.find_profile_by_email(db_session, EMAIL)
    assert profile is not None
    supabase_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    await repository.set_password_hash(db_session, profile.id, supabase_hash)

    signed_in = await client.post("/api/v1/auth/signin", json={"email": EMAIL, "password": PASSWORD})
    assert signed_in.status_code == 200, signed_in.text
    credentials = await repository.get_credentials(db_session, profile.id)
    assert credentials is not None and credentials.password_hash is not None
    assert credentials.password_hash.startswith("$argon2")


async def test_a_wrong_password_on_an_imported_hash_is_refused(
    client: AsyncClient, mailer: FakeMailer, db_session: AsyncSession
) -> None:
    await signed_up_and_verified(client, mailer)
    profile = await repository.find_profile_by_email(db_session, EMAIL)
    assert profile is not None
    supabase_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
    await repository.set_password_hash(db_session, profile.id, supabase_hash)
    # The request shares this session, and a refused request rolls back to the last
    # commit; committing here (only a savepoint release) keeps the setup out of that.
    await db_session.commit()

    refused = await client.post(
        "/api/v1/auth/signin", json={"email": EMAIL, "password": "Not-the-password-1"}
    )
    assert (refused.status_code, refused.json()["code"]) == (401, "wrong_credentials")
    credentials = await repository.get_credentials(db_session, profile.id)
    assert credentials is not None and credentials.password_hash == supabase_hash
