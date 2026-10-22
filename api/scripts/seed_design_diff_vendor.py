"""Seed or refresh the local design-diff vendor (compose Postgres only).

Creates ``design-diff-vendor@example.com`` with password ``Design-Diff-Passw0rd!`` and a
payload that matches the Mama Ade artboards in ``web/design/canvas/project/``. Pass
``--scenario`` to set ``current_step``, onboarding status, and approval state for a
particular screen diff.

Refuses non-local ``DATABASE_URL``.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import dispose_engine, job_session
from app.core.settings import get_settings
from app.features.bookings import repository as bookings_repository
from app.features.identity import repository as identity_repository
from app.features.identity.domain_accounts import normalise_email
from app.features.identity.tokens import hash_password
from app.features.vendors import repository as vendors_repository

LOCAL_HOSTS = frozenset({"127.0.0.1", "localhost"})
EMAIL = "design-diff-vendor@example.com"
PASSWORD = "Design-Diff-Passw0rd!"  # noqa: S105 — local design-diff account only

CLIENT_EMAIL = "design-diff-client@example.com"
# The pending booking the vendor booking-detail screens (V13, V17 ...) open; the id is fixed in screens.json.
BOOKING_ID = "00000000-0000-4000-8000-000000000001"

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "web" / "scripts" / "design-diff" / "vendor-fixture.json"


def _assert_local_database() -> None:
    """Abort when ``DATABASE_URL`` does not point at local compose Postgres."""
    database_url = get_settings().database_url
    parsed = urlparse(database_url)
    if parsed.hostname not in LOCAL_HOSTS:
        sys.stderr.write(f"Refusing to seed design-diff vendor against non-local host: {parsed.hostname}\n")
        raise SystemExit(1)


def _load_fixture() -> dict[str, object]:
    """The shared Mama Ade payload checked in beside the design-diff harness."""
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _scenario_columns(scenario: str, payload: dict[str, object]) -> dict[str, object]:
    """Map a design-diff scenario name to vendor row columns."""
    if scenario.startswith("step-"):
        step = int(scenario.removeprefix("step-"))
        if step < 1 or step > 10:
            raise ValueError(f"Unknown step in scenario: {scenario}")
        return {
            "status": "draft",
            "approval_status": "pending",
            "current_step": step,
            "payload": payload,
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
        }
    if scenario == "submitted":
        return {
            "status": "submitted",
            "approval_status": "pending",
            "current_step": 10,
            "payload": payload,
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
        }
    if scenario == "returned":
        returned_payload = {
            **payload,
            "returnedForEditsAt": datetime(2026, 10, 19, 9, 0, tzinfo=UTC).isoformat(),
        }
        return {
            "status": "draft",
            "approval_status": "pending",
            "current_step": 9,
            "payload": returned_payload,
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
        }
    if scenario == "approved":
        return {
            "status": "submitted",
            "approval_status": "approved",
            "current_step": 10,
            "payload": payload,
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": False,
        }
    if scenario == "payout-linked":
        return {
            "status": "submitted",
            "approval_status": "approved",
            "current_step": 10,
            "payload": payload,
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": True,
        }
    raise ValueError(f"Unknown scenario: {scenario}")


async def _seed_pending_booking(session: AsyncSession, vendor_user_id: str) -> None:
    """Make sure the fixture vendor has the pending booking at `BOOKING_ID` (a no-op if it exists)."""
    if await bookings_repository.get_booking(session, BOOKING_ID) is not None:
        return
    client_email = normalise_email(CLIENT_EMAIL)
    existing_client = await identity_repository.find_credentials_by_email(session, client_email)
    if existing_client is None:
        client_user_id = await identity_repository.create_account(
            session,
            email=client_email,
            user_type="client",
            admin_role=None,
            email_verified_at=datetime.now(UTC),
            account_suspended=False,
        )
        assert client_user_id is not None
    else:
        client_user_id = existing_client.id
    await bookings_repository.insert_booking(
        session,
        {
            "id": BOOKING_ID,
            "client_user_id": client_user_id,
            "vendor_user_id": vendor_user_id,
            "event_name": "Design diff wedding",
            "event_date": date(2099, 6, 1),
            "total_label": "GBP 100.00",
            "status": "pending",
        },
    )


async def _seed(scenario: str) -> None:
    """Create or update the design-diff vendor for one scenario."""
    _assert_local_database()
    payload = _load_fixture()
    columns = _scenario_columns(scenario, payload)
    email = normalise_email(EMAIL)

    async with job_session() as session:
        existing = await identity_repository.find_credentials_by_email(session, email)
        if existing is None:
            user_id = await identity_repository.create_account(
                session,
                email=email,
                user_type="vendor",
                admin_role=None,
                email_verified_at=datetime.now(UTC),
                account_suspended=False,
            )
            assert user_id is not None
            await identity_repository.set_password_hash(session, user_id, hash_password(PASSWORD))
            vendor_exists = False
        else:
            user_id = existing.id
            await identity_repository.set_password_hash(session, user_id, hash_password(PASSWORD))
            vendor_exists = await vendors_repository.get_vendor(session, user_id) is not None

        saved = await vendors_repository.save_profile(
            session,
            user_id,
            columns,
            exists=vendor_exists,
        )
        if not saved:
            sys.stderr.write("Could not save vendor profile (business name clash).\n")
            raise SystemExit(1)
        await _seed_pending_booking(session, user_id)
        # `job_session` commits when this block ends; committing here would bypass it.
        sys.stdout.write(f"Seeded {EMAIL} scenario={scenario} user_id={user_id}\n")


def main() -> None:
    """CLI entry: ``python -m scripts.seed_design_diff_vendor --scenario step-7``."""
    parser = argparse.ArgumentParser(description="Seed the design-diff vendor account.")
    parser.add_argument(
        "--scenario",
        default="step-1",
        help="step-1..step-10, submitted, returned, approved, or payout-linked",
    )
    args = parser.parse_args()
    try:
        asyncio.run(_seed(args.scenario))
    finally:
        asyncio.run(dispose_engine())


if __name__ == "__main__":
    main()
