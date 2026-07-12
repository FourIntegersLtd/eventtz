"""Stripe integration primitives: Connect onboarding, Checkout, transfers, refunds.

Thin wrapper around the Stripe SDK plus the small amount of vendor/booking DB access needed to
drive it (mirrors the DB-touching style of the other `*_service.py` modules). Higher-level booking
money orchestration (loading/validating booking rows, writing `payment_status`, notifications)
lives in `booking_payment_service.py`; this module should stay import-safe from `app.api`.
"""

from __future__ import annotations

from typing import Any

import stripe

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client

logger = get_logger(__name__)


def _stripe() -> Any:
    """Point the SDK at the current secret key and return it. Cheap; safe to call per-request."""
    stripe.api_key = get_settings().stripe_secret_key
    return stripe


def _to_pence(amount_gbp: float) -> int:
    return int(round(amount_gbp * 100))


def stripe_object_to_dict(obj: Any) -> dict[str, Any]:
    """Normalize a Stripe SDK object (Event, Session, Account, …) to a plain dict."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    if callable(to_dict):
        return to_dict()
    return {}


def _get_vendor_row(vendor_user_id: str) -> dict[str, Any] | None:
    res = (
        get_client()
        .table("vendors")
        .select("user_id,payload,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled")
        .eq("user_id", vendor_user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def _get_user_email(user_id: str) -> str | None:
    try:
        res = get_client().table("users").select("email").eq("id", user_id).limit(1).execute()
    except Exception:
        logger.exception("stripe_service: load user email failed user=%s", user_id)
        return None
    rows = getattr(res, "data", None) or []
    if rows and isinstance(rows[0], dict):
        return rows[0].get("email")
    return None


def get_connect_status(vendor_user_id: str) -> dict[str, Any]:
    """DB-only read of the vendor's Connect state (no Stripe round trip)."""
    row = _get_vendor_row(vendor_user_id) or {}
    return {
        "stripe_account_id": row.get("stripe_account_id"),
        "charges_enabled": bool(row.get("stripe_charges_enabled")),
        "payouts_enabled": bool(row.get("stripe_payouts_enabled")),
    }


def _clear_vendor_stripe_connect(vendor_user_id: str) -> None:
    """Drop a Connect account id that no longer exists on the current Stripe platform/key."""
    get_client().table("vendors").update(
        {
            "stripe_account_id": None,
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
        },
    ).eq("user_id", vendor_user_id).execute()


def _is_orphan_connect_account_error(exc: BaseException) -> bool:
    """True when the stored acct_... belongs to another Stripe account or was deleted."""
    if isinstance(exc, stripe.PermissionError):
        return True
    if isinstance(exc, stripe.InvalidRequestError):
        msg = str(getattr(exc, "user_message", None) or exc).lower()
        return (
            "not connected to your platform" in msg
            or "does not exist" in msg
            or "does not have access to account" in msg
        )
    return False


def _create_connect_express_account(vendor_user_id: str, row: dict[str, Any] | None) -> str:
    email = _get_user_email(vendor_user_id)
    business_name = None
    if row and isinstance(row.get("payload"), dict):
        bn = row["payload"].get("businessName")
        business_name = bn.strip() if isinstance(bn, str) and bn.strip() else None
    account = _stripe().Account.create(
        type="express",
        country="GB",
        email=email or None,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_type="individual",
        business_profile={"name": business_name} if business_name else None,
    )
    account_id = str(account["id"])
    get_client().table("vendors").update({"stripe_account_id": account_id}).eq(
        "user_id",
        vendor_user_id,
    ).execute()
    logger.info("Created Stripe Connect account vendor=%s account=%s", vendor_user_id, account_id)
    return account_id


def create_connect_onboarding_link(vendor_user_id: str, return_path: str = "/vendor/onboarding") -> str:
    """Ensure a Stripe Express account exists for this vendor, then return a hosted onboarding URL.

    `return_path` lets callers bring the vendor back to wherever they started Connect from
    (onboarding vs. the standalone Payments page) once they finish on Stripe.
    """
    row = _get_vendor_row(vendor_user_id)
    account_id = row.get("stripe_account_id") if row else None

    if account_id:
        try:
            _stripe().Account.retrieve(account_id)
        except Exception as e:
            if _is_orphan_connect_account_error(e):
                logger.warning(
                    "Stale Stripe Connect account vendor=%s account=%s — recreating",
                    vendor_user_id,
                    account_id,
                )
                _clear_vendor_stripe_connect(vendor_user_id)
                account_id = None
            else:
                raise

    if not account_id:
        account_id = _create_connect_express_account(vendor_user_id, row)

    settings = get_settings()
    safe_path = return_path if return_path in {"/vendor/onboarding", "/vendor/payments"} else "/vendor/onboarding"
    try:
        link = _stripe().AccountLink.create(
            account=account_id,
            refresh_url=f"{settings.frontend_url}{safe_path}?stripe=refresh",
            return_url=f"{settings.frontend_url}{safe_path}?stripe=return",
            type="account_onboarding",
        )
    except Exception as e:
        if _is_orphan_connect_account_error(e):
            logger.warning(
                "Stripe rejected account link vendor=%s account=%s — recreating",
                vendor_user_id,
                account_id,
            )
            _clear_vendor_stripe_connect(vendor_user_id)
            account_id = _create_connect_express_account(vendor_user_id, row)
            link = _stripe().AccountLink.create(
                account=account_id,
                refresh_url=f"{settings.frontend_url}{safe_path}?stripe=refresh",
                return_url=f"{settings.frontend_url}{safe_path}?stripe=return",
                type="account_onboarding",
            )
        else:
            raise
    return str(link["url"])


def sync_connect_account_status(vendor_user_id: str) -> dict[str, Any]:
    """Refresh charges_enabled/payouts_enabled from Stripe and persist onto `vendors`."""
    row = _get_vendor_row(vendor_user_id)
    account_id = row.get("stripe_account_id") if row else None
    if not account_id:
        return {"stripe_account_id": None, "charges_enabled": False, "payouts_enabled": False}

    try:
        account = stripe_object_to_dict(_stripe().Account.retrieve(account_id))
    except Exception as e:
        if _is_orphan_connect_account_error(e):
            logger.warning(
                "Stale Stripe Connect account vendor=%s account=%s — clearing",
                vendor_user_id,
                account_id,
            )
            _clear_vendor_stripe_connect(vendor_user_id)
            return {"stripe_account_id": None, "charges_enabled": False, "payouts_enabled": False}
        raise

    charges_enabled = bool(account.get("charges_enabled"))
    payouts_enabled = bool(account.get("payouts_enabled"))
    get_client().table("vendors").update(
        {
            "stripe_charges_enabled": charges_enabled,
            "stripe_payouts_enabled": payouts_enabled,
        },
    ).eq("user_id", vendor_user_id).execute()
    return {
        "stripe_account_id": account_id,
        "charges_enabled": charges_enabled,
        "payouts_enabled": payouts_enabled,
    }


def sync_connect_account_status_by_account_id(account_id: str) -> str | None:
    """Same as `sync_connect_account_status` but keyed by Stripe account id (for `account.updated` webhooks)."""
    res = (
        get_client()
        .table("vendors")
        .select("user_id")
        .eq("stripe_account_id", account_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict) or not rows[0].get("user_id"):
        return None
    vendor_user_id = str(rows[0]["user_id"])
    sync_connect_account_status(vendor_user_id)
    return vendor_user_id


def create_checkout_session(
    *,
    booking_id: str,
    client_total_gbp: float,
    vendor_amount_gbp: float,
    service_fee_gbp: float,
    vendor_user_id: str,
    client_user_id: str,
    description: str,
) -> dict[str, str]:
    """Create a Checkout Session for the full client total. Funds land in Eventtz's own Stripe
    balance (no `transfer_data`) — the vendor is paid later via an explicit Transfer."""
    settings = get_settings()
    metadata = {
        "booking_id": booking_id,
        "vendor_user_id": vendor_user_id,
        "client_user_id": client_user_id,
        "vendor_amount_gbp": f"{vendor_amount_gbp:.2f}",
        "service_fee_gbp": f"{service_fee_gbp:.2f}",
    }
    session = _stripe().checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "gbp",
                    "unit_amount": _to_pence(client_total_gbp),
                    "product_data": {"name": description[:500] or "Eventtz booking"},
                },
                "quantity": 1,
            },
        ],
        metadata=metadata,
        payment_intent_data={"metadata": metadata},
        billing_address_collection="required",
        success_url=(
            f"{settings.frontend_url}/client/bookings/{booking_id}"
            "?payment=success&session_id={CHECKOUT_SESSION_ID}"
        ),
        cancel_url=f"{settings.frontend_url}/client/bookings/{booking_id}?payment=cancelled",
        # No idempotency_key here: creating a Session never moves money, and a deterministic key
        # would return a stale/expired session on retry. Money movement (Transfer/Refund below)
        # does use deterministic keys since those calls are irreversible.
    )
    return {"id": str(session["id"]), "url": str(session["url"])}


def retrieve_checkout_session(session_id: str) -> Any:
    return _stripe().checkout.Session.retrieve(session_id, expand=["payment_intent"])


def construct_webhook_event(payload: bytes, sig_header: str) -> Any:
    settings = get_settings()
    return _stripe().Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


def retrieve_payment_intent(payment_intent_id: str) -> Any:
    return _stripe().PaymentIntent.retrieve(payment_intent_id, expand=["latest_charge"])


def create_transfer(
    *,
    destination_account_id: str,
    amount_gbp: float,
    booking_id: str,
) -> str:
    """Release the vendor's cut from Eventtz's Stripe balance to their connected account."""
    transfer = _stripe().Transfer.create(
        amount=_to_pence(amount_gbp),
        currency="gbp",
        destination=destination_account_id,
        transfer_group=f"booking_{booking_id}",
        metadata={"booking_id": booking_id},
        idempotency_key=f"transfer-{booking_id}",
    )
    return str(transfer["id"])


def create_refund(
    *,
    payment_intent_id: str,
    booking_id: str,
    amount_gbp: float | None = None,
    idempotency_suffix: str = "full",
) -> str:
    kwargs: dict[str, Any] = {
        "payment_intent": payment_intent_id,
        "metadata": {"booking_id": booking_id},
    }
    if amount_gbp is not None:
        kwargs["amount"] = _to_pence(amount_gbp)
    refund = _stripe().Refund.create(
        **kwargs,
        idempotency_key=f"refund-{booking_id}-{idempotency_suffix}",
    )
    return str(refund["id"])
