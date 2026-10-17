"""Pure money rules for a booking's payment lifecycle: pence, idempotency keys and Stripe fields.

`payment_status` is its own lifecycle beside `status` (AGENTS.md "two lifecycles"):
unpaid -> pending (checkout open) -> paid -> payout_released, or paid -> refunded /
partially_refunded. The services write it only with an expected-status condition.
Amounts arrive as GBP floats from the baseline's numeric columns and are turned into
integer pence here, the one place rounding happens.
"""

from __future__ import annotations

from datetime import date
from typing import Any

# Statuses from which a checkout may start (or restart) and be marked paid.
PAYABLE_PAYMENT_STATUSES = ("unpaid", "pending")
# Money has been received and not yet sent anywhere: refunds and payouts start here.
PAID = "paid"
PAYOUT_RELEASED = "payout_released"
REFUNDED = "refunded"
PARTIALLY_REFUNDED = "partially_refunded"
# Statuses where checkout sync has nothing left to do.
SETTLED_PAYMENT_STATUSES = (PAID, PAYOUT_RELEASED, REFUNDED, PARTIALLY_REFUNDED)
# A checkout that lands in either of these was (or has already been) paid successfully.
PAID_PAYMENT_STATUSES = (PAID, PAYOUT_RELEASED)
# Refunding a Checkout payment the booking cannot take only ever rewrites a row still waiting
# for money (`service_payments_checkout.refund_checkout_payment`): a `paid` row holds a
# different, valid payment, so a stray session's refund must never touch it.
CHECKOUT_REFUND_REWRITABLE_STATUSES = PAYABLE_PAYMENT_STATUSES

DEFAULT_CHECKOUT_DESCRIPTION = "Eventtz booking"
# Stripe caps a product name at 500 characters.
_MAX_CHECKOUT_DESCRIPTION = 500
# Stripe ids are short; anything longer (or containing JSON) is a serialised object, not an id.
_MAX_STRIPE_ID_LENGTH = 255


def gbp_to_pence(amount_gbp: float) -> int:
    """GBP to integer pence, rounded the baseline's way (`int(round(gbp * 100))`)."""
    return int(round(amount_gbp * 100))


def pence_to_gbp(amount_pence: int) -> float:
    """Integer pence to GBP, for the baseline's numeric money columns."""
    return amount_pence / 100.0


def transfer_group(booking_id: str) -> str:
    """The Stripe transfer group for a booking, used to find a payout that already happened."""
    return f"booking_{booking_id}"


def refund_idempotency_key(booking_id: str, suffix: str) -> str:
    """The "don't refund twice" key: one refund per booking and reason (`full`, `partial`, `cancel-…`)."""
    return f"refund-{booking_id}-{suffix}"


def transfer_idempotency_key(
    *,
    booking_id: str,
    amount_pence: int,
    destination_account_id: str,
    source_charge_id: str | None,
) -> str:
    """The "don't pay twice" key for a vendor payout.

    Stripe binds a key to its exact parameters, so the amount, destination and funding
    charge are all in it: a retry with corrected values must not clash with an earlier
    failed attempt (e.g. one funded from the platform balance).
    """
    base = f"transfer-{booking_id}-{amount_pence}-{destination_account_id}"
    if source_charge_id and source_charge_id.startswith("ch_"):
        return f"{base}-src-{source_charge_id}"
    return base


def checkout_description(event_name: str | None, *, deposit_pence: int = 0) -> str:
    """The Checkout line item's name: the event name, trimmed to Stripe's limit.

    With a damage deposit the name says so, since the charge is the booking plus the deposit.
    """
    name = (event_name or DEFAULT_CHECKOUT_DESCRIPTION)[
        :_MAX_CHECKOUT_DESCRIPTION
    ] or DEFAULT_CHECKOUT_DESCRIPTION
    if deposit_pence <= 0:
        return name
    suffix = f" (includes £{deposit_pence // 100}.{deposit_pence % 100:02d} refundable deposit)"
    return name[: _MAX_CHECKOUT_DESCRIPTION - len(suffix)] + suffix


def checkout_metadata(
    *,
    booking_id: str,
    vendor_user_id: str,
    client_user_id: str,
    client_total_gbp: float,
    vendor_amount_gbp: float,
    service_fee_gbp: float,
    referral_fee_discount_gbp: float,
    damage_deposit_gbp: float = 0.0,
) -> dict[str, str]:
    """The metadata a Checkout Session carries, read back when it completes.

    The amounts are the server's own re-priced figures, never the client's; finalisation
    checks the charged total against `client_total_gbp` before marking the booking paid.
    """
    metadata = {
        "booking_id": booking_id,
        "vendor_user_id": vendor_user_id,
        "client_user_id": client_user_id,
        "client_total_gbp": f"{client_total_gbp:.2f}",
        "vendor_amount_gbp": f"{vendor_amount_gbp:.2f}",
        "service_fee_gbp": f"{service_fee_gbp:.2f}",
        "referral_fee_discount_gbp": f"{max(0.0, referral_fee_discount_gbp):.2f}",
    }
    if damage_deposit_gbp > 0:
        # Included in `client_total_gbp`; held apart and refunded after the event unless claimed.
        metadata["damage_deposit_gbp"] = f"{damage_deposit_gbp:.2f}"
    return metadata


def checkout_urls(frontend_url: str, booking_id: str) -> tuple[str, str]:
    """The (success, cancel) URLs for a booking's Checkout Session.

    `{CHECKOUT_SESSION_ID}` is Stripe's own placeholder, filled in on redirect, so the
    booking page can sync the session if the webhook is slow.
    """
    booking_page = f"{frontend_url}/client/bookings/{booking_id}"
    return (
        f"{booking_page}?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
        f"{booking_page}?payment=cancelled",
    )


def metadata_amount_gbp(metadata: dict[str, Any], key: str) -> float | None:
    """A GBP amount from session metadata, or None when missing or unreadable."""
    raw = metadata.get(key)
    if not raw:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def expected_checkout_pence(metadata: dict[str, Any]) -> int | None:
    """What the session should have charged: its client total, or vendor amount + fee for old sessions."""
    client_total = metadata.get("client_total_gbp")
    if client_total is not None:
        try:
            return gbp_to_pence(float(client_total))
        except (TypeError, ValueError):
            pass
    try:
        return gbp_to_pence(float(metadata["vendor_amount_gbp"]) + float(metadata["service_fee_gbp"]))
    except (TypeError, ValueError, KeyError):
        return None


def charge_id_from_payment_intent(payment_intent: dict[str, Any]) -> str | None:
    """The charge behind a payment intent (`latest_charge`, expanded or a bare `ch_…` id)."""
    latest_charge = payment_intent.get("latest_charge")
    if isinstance(latest_charge, dict):
        charge_id = latest_charge.get("id")
        return str(charge_id) if charge_id else None
    if isinstance(latest_charge, str) and latest_charge.startswith("ch_"):
        return latest_charge
    return None


def payment_intent_id_from_session(session: dict[str, Any]) -> str | None:
    """The `pi_…` id of a Checkout Session, whether `payment_intent` is expanded or not.

    Only a bare Stripe id is returned, never a stringified object, since it is stored.
    """
    payment_intent = session.get("payment_intent")
    if isinstance(payment_intent, str):
        text = payment_intent.strip()
        if text.startswith("pi_") and len(text) < _MAX_STRIPE_ID_LENGTH and "{" not in text:
            return text
        return None
    if isinstance(payment_intent, dict):
        intent_id = payment_intent.get("id")
        if isinstance(intent_id, str) and intent_id.startswith("pi_"):
            return intent_id
    return None


def charge_id_from_session(session: dict[str, Any]) -> str | None:
    """The charge id when the session's payment intent came back expanded; None otherwise."""
    payment_intent = session.get("payment_intent")
    if isinstance(payment_intent, dict):
        return charge_id_from_payment_intent(payment_intent)
    return None


def usable_charge_id(charge_id: str | None) -> str | None:
    """The id when it names a charge (`ch_…`), else None."""
    text = (charge_id or "").strip()
    return text if text.startswith("ch_") else None


def usable_payment_intent_id(payment_intent_id: str | None) -> str | None:
    """The id when it names a payment intent (`pi_…`), else None."""
    text = (payment_intent_id or "").strip()
    return text if text.startswith("pi_") else None


def is_missing_checkout_session(stripe_code: str, message: str) -> bool:
    """Whether Stripe's refusal means the Checkout Session no longer exists (expired, or another account).

    Stripe says `resource_missing`; older errors only name the object ("No such checkout.session").
    """
    return stripe_code == "resource_missing" or "checkout.session" in message.lower()


def parse_event_date(event_date: str | None) -> date | None:
    """The booking's first day from its stored ISO text, or None when missing or unreadable."""
    text = (event_date or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None
