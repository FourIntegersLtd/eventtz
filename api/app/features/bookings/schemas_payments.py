"""Response shapes of the vendor payout ledger (checkout's are in `schemas.py`, beside the client routes).

Field names are the baseline's (`contracts/payments.py`); the web app reads them directly.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class VendorPayoutRow(BaseModel):
    """One booking's vendor share: never the client total, which includes the Eventtz fee."""

    booking_id: str
    event_name: str
    event_date: str | None = None
    client_display_name: str | None = None
    amount_gbp: float
    amount_label: str
    # paid_out | awaiting_payout
    status: str
    paid_out_at: str | None = None
    # event_payout (the price, after the event) | cancellation_share (what a client cancel left the vendor)
    kind: str = "event_payout"


class VendorPayoutLedger(BaseModel):
    """What Eventtz has sent a vendor and what is still to come, newest first."""

    payouts: list[VendorPayoutRow] = Field(default_factory=list)
    total_paid_out_gbp: float = 0.0
    total_paid_out_label: str = "GBP 0"
    total_awaiting_gbp: float = 0.0
    total_awaiting_label: str = "GBP 0"
