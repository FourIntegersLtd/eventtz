"""A profile save whose row cannot be read back is a coded 500, not an unhandled crash."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import MakeActor

pytestmark = pytest.mark.db


async def test_a_profile_save_that_reads_back_nothing_is_a_coded_500(
    client: AsyncClient, db_session: AsyncSession, make_actor: MakeActor
) -> None:
    """A trigger removes each new vendor row as it is written, so the read-back after the save finds none.

    The trigger lives in the test's rolled-back transaction, so nothing is left behind.
    """
    await db_session.execute(
        text(
            "CREATE FUNCTION pg_temp.drop_new_vendor() RETURNS trigger LANGUAGE plpgsql AS "
            "$$ BEGIN DELETE FROM vendors WHERE user_id = NEW.user_id; RETURN NULL; END $$"
        )
    )
    await db_session.execute(
        text(
            "CREATE TRIGGER drop_new_vendor AFTER INSERT ON vendors "
            "FOR EACH ROW EXECUTE FUNCTION pg_temp.drop_new_vendor()"
        )
    )
    token = await make_actor("vendor@example.com", user_type="vendor")

    response = await client.put(
        "/api/v1/vendor/profile",
        json={"current_step": 1, "profile_form_data": {}},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 500
    assert response.json()["code"] == "vendor_profile_save_failed"
