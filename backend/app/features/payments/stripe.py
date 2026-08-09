"""Talk to Stripe: vendor payout setup, client checkout, paying vendors, and refunds.

Booking status checks and notifications live in bookings/payments.py.
This file is the Stripe-specific toolkit those booking flows call into.
"""

from __future__ import annotations

from typing import Any

import stripe

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.core.phone_validation import phone_digits_only

logger = get_logger(__name__)


def _stripe() -> Any:
    """Set the secret key on the SDK and return it. Cheap to call on every request."""
    stripe.api_key = get_settings().stripe_secret_key
    return stripe


def _to_pence(amount_gbp: float) -> int:
    return int(round(amount_gbp * 100))


def stripe_object_to_dict(obj: Any) -> dict[str, Any]:
    """Turn a Stripe SDK object (Event, Session, Account, …) into a plain dict."""
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
    """Read the vendor's Connect state from the database (no Stripe API call)."""
    row = _get_vendor_row(vendor_user_id) or {}
    return {
        "stripe_account_id": row.get("stripe_account_id"),
        "charges_enabled": bool(row.get("stripe_charges_enabled")),
        "payouts_enabled": bool(row.get("stripe_payouts_enabled")),
    }


def _clear_vendor_stripe_connect(vendor_user_id: str) -> None:
    """Remove a Connect account id that no longer exists on the current Stripe account or key."""
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
            or "no such account" in msg
        )
    return False


def _payload_str(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _normalize_phone_for_stripe(phone: str | None) -> str | None:
    """Best-effort E.164 for prefill only; skip anything we can't confidently convert.

    Stripe rejects malformed phone numbers, so an unrecognised format is left blank
    rather than risk failing account creation - the vendor can still fill it in on
    Stripe's onboarding form.
    """
    if not phone:
        return None
    trimmed = phone.strip()
    if not trimmed:
        return None
    if trimmed.startswith("+"):
        digits = phone_digits_only(trimmed)
        return f"+{digits}" if digits else None
    digits = phone_digits_only(trimmed)
    if trimmed.startswith("0") and 10 <= len(digits) <= 11:
        return f"+44{digits[1:]}"
    return None


def _build_connect_prefill(
    vendor_user_id: str,
    row: dict[str, Any] | None,
) -> tuple[str | None, dict[str, Any], dict[str, Any]]:
    """Build the (email, individual, business_profile) prefill from data we already have.

    Only usable at Account.create time - Stripe blocks the platform from editing an
    Express account's identity fields via Account.modify once it exists (see caller).
    """
    email = _get_user_email(vendor_user_id)
    payload = row.get("payload") if row and isinstance(row.get("payload"), dict) else {}
    business_name = _payload_str(payload, "businessName")

    individual: dict[str, Any] = {}
    if email:
        individual["email"] = email
    first_name = _payload_str(payload, "firstName")
    if first_name:
        individual["first_name"] = first_name
    last_name = _payload_str(payload, "lastName")
    if last_name:
        individual["last_name"] = last_name
    phone = _normalize_phone_for_stripe(_payload_str(payload, "phone"))
    if phone:
        individual["phone"] = phone

    address: dict[str, Any] = {}
    base_city = _payload_str(payload, "baseCity")
    if base_city:
        address["city"] = base_city
    region = _payload_str(payload, "region")
    if region:
        address["state"] = region
    postal_code = _payload_str(payload, "postalCode")
    if postal_code:
        address["postal_code"] = postal_code
    if address:
        address["country"] = "GB"
        individual["address"] = address

    business_profile = {"name": business_name} if business_name else {}
    return email, individual, business_profile


def _create_connect_express_account(vendor_user_id: str, row: dict[str, Any] | None) -> str:
    """Create a fresh Stripe Express account, prefilled with data we already have.

    This is the only place prefill can happen: Stripe lets the platform set
    `individual` / `business_profile` at Account.create time, but permanently blocks
    any later Account.modify to those fields ("This application does not have the
    required permissions for the parameter 'individual'") - after creation, only the
    vendor can edit them, via Stripe's own onboarding UI or Express dashboard.
    """
    email, individual, business_profile = _build_connect_prefill(vendor_user_id, row)
    account = _stripe().Account.create(
        type="express",
        country="GB",
        email=email or None,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_type="individual",
        business_profile=business_profile or None,
        individual=individual or None,
    )
    account_id = str(account["id"])
    get_client().table("vendors").update({"stripe_account_id": account_id}).eq(
        "user_id",
        vendor_user_id,
    ).execute()
    logger.info("Created Stripe Connect account vendor=%s account=%s", vendor_user_id, account_id)
    return account_id


def _safe_connect_return_path(return_path: str) -> str:
    """Allowlist frontend paths for Stripe Connect return/refresh URLs.

    Why: Stripe redirect URLs must not become an open redirect; only Payments and
    Accept resume (`/vendor/bookings/{id}`) are valid post-Connect destinations.
    """
    path = (return_path or "").strip() or "/vendor/payments"
    if path == "/vendor/payments" or path == "/vendor/onboarding":
        # /vendor/onboarding redirects to profile; send vendors to Payments instead.
        return "/vendor/payments"
    # Accept-time Connect: /vendor/bookings/{uuid}
    if path.startswith("/vendor/bookings/"):
        booking_id = path[len("/vendor/bookings/") :].split("?", 1)[0].strip("/")
        if booking_id and "/" not in booking_id and len(booking_id) <= 64:
            return f"/vendor/bookings/{booking_id}"
    return "/vendor/payments"


def create_connect_onboarding_link(vendor_user_id: str, return_path: str = "/vendor/payments") -> str:
    """Create a Stripe Express account for this vendor if needed, then return an onboarding URL.

    `return_path` is where the vendor lands after Stripe (Payments page or a booking detail).
    """
    row = _get_vendor_row(vendor_user_id)
    account_id = row.get("stripe_account_id") if row else None

    if account_id:
        try:
            _stripe().Account.retrieve(account_id)
        except Exception as e:
            if _is_orphan_connect_account_error(e):
                logger.warning(
                    "Stale Stripe Connect account vendor=%s account=%s - recreating",
                    vendor_user_id,
                    account_id,
                )
                _clear_vendor_stripe_connect(vendor_user_id)
                account_id = None
            else:
                raise

    if not account_id:
        account_id = _create_connect_express_account(vendor_user_id, row)

    safe_path = _safe_connect_return_path(return_path)
    try:
        return _create_account_link_url(account_id, safe_path)
    except Exception as e:
        if not _is_orphan_connect_account_error(e):
            raise
        logger.warning(
            "Stripe rejected account link vendor=%s account=%s - recreating",
            vendor_user_id,
            account_id,
        )
        _clear_vendor_stripe_connect(vendor_user_id)
        account_id = _create_connect_express_account(vendor_user_id, row)
        return _create_account_link_url(account_id, safe_path)


def _create_account_link_url(account_id: str, safe_path: str) -> str:
    settings = get_settings()
    link = _stripe().AccountLink.create(
        account=account_id,
        refresh_url=f"{settings.frontend_url}{safe_path}?stripe=refresh",
        return_url=f"{settings.frontend_url}{safe_path}?stripe=return",
        type="account_onboarding",
    )
    return str(link["url"])


def sync_connect_account_status(vendor_user_id: str) -> dict[str, Any]:
    """Fetch charges_enabled and payouts_enabled from Stripe and save them on the vendor row."""
    row = _get_vendor_row(vendor_user_id)
    account_id = row.get("stripe_account_id") if row else None
    if not account_id:
        return {"stripe_account_id": None, "charges_enabled": False, "payouts_enabled": False}

    try:
        account = stripe_object_to_dict(_stripe().Account.retrieve(account_id))
    except Exception as e:
        if _is_orphan_connect_account_error(e):
            logger.warning(
                "Stale Stripe Connect account vendor=%s account=%s - clearing",
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
    """Like sync_connect_account_status, but looked up by Stripe account id (for account.updated webhooks)."""
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
    """Create a Checkout Session for the full client total. Money goes to Eventtz's Stripe
    balance first - the vendor is paid later via an explicit Transfer."""
    settings = get_settings()
    metadata = {
        "booking_id": booking_id,
        "vendor_user_id": vendor_user_id,
        "client_user_id": client_user_id,
        "client_total_gbp": f"{client_total_gbp:.2f}",
        "vendor_amount_gbp": f"{vendor_amount_gbp:.2f}",
        "service_fee_gbp": f"{service_fee_gbp:.2f}",
    }
    client_email = _get_user_email(client_user_id)
    session_kwargs: dict[str, Any] = {}
    if client_email:
        # Prefills the email field on Stripe's hosted Checkout page so the client
        # doesn't have to retype an address we already have on file.
        session_kwargs["customer_email"] = client_email
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
        # Don't reuse a fixed "don't send twice" key here: starting checkout doesn't
        # take payment, and reusing a key can hand back an old expired link.
        # Paying the vendor and refunds do use those keys because they can't be undone.
        **session_kwargs,
    )
    return {"id": str(session["id"]), "url": str(session["url"])}


def retrieve_checkout_session(session_id: str) -> Any:
    return _stripe().checkout.Session.retrieve(session_id, expand=["payment_intent"])


def construct_webhook_event(payload: bytes, sig_header: str) -> Any:
    settings = get_settings()
    return _stripe().Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


def retrieve_payment_intent(payment_intent_id: str) -> Any:
    return _stripe().PaymentIntent.retrieve(payment_intent_id, expand=["latest_charge"])


def find_existing_transfer_id(booking_id: str) -> str | None:
    """Return an existing Stripe Transfer for this booking, if any (by transfer_group)."""
    group = f"booking_{booking_id}"
    try:
        listed = _stripe().Transfer.list(transfer_group=group, limit=10)
    except Exception:
        logger.exception("stripe: list transfers failed booking=%s", booking_id)
        return None
    rows = getattr(listed, "data", None) or []
    for row in rows:
        tid = str(getattr(row, "id", None) or (row.get("id") if isinstance(row, dict) else "") or "")
        if tid:
            return tid
    return None


def create_transfer(
    *,
    destination_account_id: str,
    amount_gbp: float,
    booking_id: str,
) -> str:
    """Pay the vendor from Eventtz's Stripe balance into their connected account.

    If we already paid this booking, return that earlier payment id.
    The "don't send twice" key includes amount and destination so a retry with
    corrected values does not clash with an earlier attempt.
    """
    existing = find_existing_transfer_id(booking_id)
    if existing:
        logger.info(
            "stripe: reclaiming existing transfer=%s booking=%s",
            existing,
            booking_id,
        )
        return existing

    amount_pence = _to_pence(amount_gbp)
    if amount_pence < 1:
        raise ValueError("Transfer amount must be at least £0.01.")
    dest = destination_account_id.strip()
    try:
        transfer = _stripe().Transfer.create(
            amount=amount_pence,
            currency="gbp",
            destination=dest,
            transfer_group=f"booking_{booking_id}",
            metadata={"booking_id": booking_id},
            idempotency_key=f"transfer-{booking_id}-{amount_pence}-{dest}",
        )
        return str(transfer["id"])
    except stripe.IdempotencyError:
        reclaimed = find_existing_transfer_id(booking_id)
        if reclaimed:
            return reclaimed
        raise


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
