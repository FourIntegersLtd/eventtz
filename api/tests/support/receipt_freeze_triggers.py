"""Postgres triggers that fail receipt snapshot writes, for savepoint isolation tests."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_CHECKOUT_FUNCTION = "test_block_payment_receipt_snapshot_write"
_CHECKOUT_TRIGGER = "test_block_payment_receipt_snapshot"
_PAYOUT_FUNCTION = "test_block_vendor_payout_statement_write"
_PAYOUT_TRIGGER = "test_block_vendor_payout_statement"


async def block_checkout_receipt_snapshot_writes(session: AsyncSession) -> None:
    """Raise on any ``payment_receipt_snapshot`` update in this transaction (rolls back with the test)."""
    await session.execute(
        text(
            f"""
            CREATE OR REPLACE FUNCTION {_CHECKOUT_FUNCTION}()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'receipt freeze blocked';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
    )
    await session.execute(
        text(
            f"""
            CREATE TRIGGER {_CHECKOUT_TRIGGER}
            BEFORE UPDATE ON booking_requests
            FOR EACH ROW
            WHEN (NEW.payment_receipt_snapshot IS DISTINCT FROM OLD.payment_receipt_snapshot)
            EXECUTE FUNCTION {_CHECKOUT_FUNCTION}();
            """
        )
    )


async def block_payout_statement_snapshot_writes(session: AsyncSession) -> None:
    """Raise on any ``vendor_payout_statement_snapshot`` update in this transaction."""
    await session.execute(
        text(
            f"""
            CREATE OR REPLACE FUNCTION {_PAYOUT_FUNCTION}()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'receipt freeze blocked';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
    )
    await session.execute(
        text(
            f"""
            CREATE TRIGGER {_PAYOUT_TRIGGER}
            BEFORE UPDATE ON booking_requests
            FOR EACH ROW
            WHEN (NEW.vendor_payout_statement_snapshot IS DISTINCT FROM OLD.vendor_payout_statement_snapshot)
            EXECUTE FUNCTION {_PAYOUT_FUNCTION}();
            """
        )
    )
