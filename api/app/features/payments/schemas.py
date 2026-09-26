"""Request and response shapes for vendor payout setup and the Stripe webhook.

Field names are the baseline's (`contracts/payments.py`); the web app reads them directly.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.features.bookings.schemas_payments import VendorPayoutLedger


class VendorPaymentsConnectResponse(BaseModel):
    """Where to send the vendor to set up (or resume setting up) Stripe payouts."""

    success: bool = True
    onboarding_url: str


class ConnectState(BaseModel):
    """What the vendor's Connect account can do, as last stored (or just read from Stripe)."""

    stripe_account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False


class VendorPaymentsStatusResponse(ConnectState):
    """The vendor's payout setup, and whether they may accept bookings."""

    success: bool = True
    # The same rule as accepting a client's booking request (an admin listing waiver counts).
    can_accept_bookings: bool = False
    payout_gate_waived: bool = False


class VendorPayoutHistoryResponse(VendorPayoutLedger):
    """The vendor's payout ledger."""

    success: bool = True


class StripeWebhookResponse(BaseModel):
    """Every correctly signed webhook gets this, whatever happened while handling it."""

    success: bool = True
