"""Talk to Stripe: vendor payout setup, client checkout, paying vendors, and refunds.

Booking status checks and notifications live in bookings/payments.py.
This file is the Stripe-specific toolkit those booking flows call into.
"""

from __future__ import annotations

from typing import Any

import stripe

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError
from app.core.logging import get_logger
from app.core.db import get_db
from app.features.payments import messages as payment_messages
from app.core.phone_validation import phone_digits_only

logger = get_logger(__name__)


def _stripe() -> Any:
    """Set the secret key on the SDK and return it. Cheap to call on every request."""
    stripe.api_key = get_settings().stripe_secret_key
    return stripe


def delete_connect_account(account_id: str) -> None:
    """Best-effort delete of a vendor's Stripe Connect Express account."""
    acct = str(account_id or "").strip()
    if not acct:
        return
    _stripe().Account.delete(acct)


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
        get_db()
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
        res = get_db().table("users").select("email").eq("id", user_id).limit(1).execute()
    except Exception:
        logger.exception("stripe_service: load user email failed user=%s", user_id)
        return None
    rows = getattr(res, "data", None) or []
    if rows and isinstance(rows[0], dict):
        return rows[0].get("email")
    return None


def _connect_status_from_row(row: dict[str, Any] | None) -> dict[str, Any]:
    data = row or {}
    return {
        "stripe_account_id": data.get("stripe_account_id"),
        "charges_enabled": bool(data.get("stripe_charges_enabled")),
        "payouts_enabled": bool(data.get("stripe_payouts_enabled")),
    }


def get_connect_status(vendor_user_id: str) -> dict[str, Any]:
    """Read the vendor's Connect state from the database (no Stripe API call)."""
    return _connect_status_from_row(_get_vendor_row(vendor_user_id))


def vendor_has_payout_history(vendor_user_id: str) -> bool:
    """True when this vendor has at least one booking with a released Stripe Transfer."""
    try:
        res = (
            get_db()
            .table("booking_requests")
            .select("id")
            .eq("vendor_user_id", vendor_user_id)
            .not_.is_("stripe_transfer_id", "null")
            .limit(1)
            .execute()
        )
    except Exception:
        logger.warning(
            "vendor_has_payout_history lookup failed vendor=%s",
            vendor_user_id,
            exc_info=True,
        )
        return False
    rows = getattr(res, "data", None) or []
    return bool(rows)


def _clear_vendor_stripe_connect(
    vendor_user_id: str,
    *,
    trigger: str,
    stripe_error: str | None = None,
    admin_user_id: str | None = None,
) -> bool:
    """Remove a Connect account id that no longer exists on the current Stripe platform.

    Returns True when cleared, False when blocked (e.g. vendor has payout history).
    """
    row = _get_vendor_row(vendor_user_id) or {}
    previous_account_id = row.get("stripe_account_id")

    if vendor_has_payout_history(vendor_user_id):
        logger.error(
            "Refused to clear Stripe Connect vendor=%s account=%s trigger=%s "
            "reason=payout_history_exists error=%s",
            vendor_user_id,
            previous_account_id,
            trigger,
            stripe_error,
        )
        return False

    if not previous_account_id:
        return False

    logger.warning(
        "Clearing Stripe Connect vendor=%s account=%s trigger=%s error=%s",
        vendor_user_id,
        previous_account_id,
        trigger,
        stripe_error,
    )
    get_db().table("vendors").update(
        {
            "stripe_account_id": None,
            "stripe_charges_enabled": False,
            "stripe_payouts_enabled": False,
        },
    ).eq("user_id", vendor_user_id).execute()

    from app.features.admin.audit import insert_admin_audit_log

    insert_admin_audit_log(
        admin_user_id=admin_user_id or "",
        action="vendor.stripe_connect_cleared",
        entity_type="vendor",
        entity_id=vendor_user_id,
        audit_event_details={
            "trigger": trigger,
            "previous_stripe_account_id": previous_account_id,
            "stripe_error": (stripe_error or "")[:500] or None,
        },
    )
    return True


def _is_orphan_connect_account_error(exc: BaseException) -> bool:
    """True only when Stripe explicitly says the stored acct_... is gone or not on this platform.

    PermissionError alone is NOT treated as orphan — that often means test/live key mismatch
    and must not wipe a vendor who already received payouts.
    """
    if isinstance(exc, stripe.InvalidRequestError):
        msg = str(getattr(exc, "user_message", None) or exc).lower()
        return (
            "not connected to your platform" in msg
            or "does not exist" in msg
            or "does not have access to account" in msg
            or "no such account" in msg
        )
    return False


def _is_platform_connect_setup_error(exc: BaseException) -> bool:
    """True when Eventtz's own Stripe platform account cannot create Connect accounts yet."""
    if isinstance(exc, stripe.InvalidRequestError):
        msg = str(getattr(exc, "user_message", None) or exc).lower()
        return (
            "must be activated" in msg
            or "complete your account setup" in msg
            or "complete your platform profile" in msg
            or "platform profile" in msg
            or "create live connected accounts" in msg
            or "connect/accounts/overview" in msg
            or "connect is not enabled" in msg
            or "signed up for connect" in msg
        )
    if isinstance(exc, stripe.PermissionError):
        msg = str(exc).lower()
        return "connect" in msg and "platform" in msg
    return False


def _raise_if_platform_connect_unavailable(exc: BaseException) -> None:
    if not _is_platform_connect_setup_error(exc):
        return
    logger.error(
        "Stripe Connect unavailable - activate the platform Stripe account before vendor onboarding: %s",
        exc,
    )
    raise ServiceUnavailableError(
        "Payout setup is temporarily unavailable while we finish payment setup on Eventtz. "
        "Please try again in a little while, or contact support if this continues.",
        code="stripe_connect_unavailable",
    ) from exc


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
    try:
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
    except Exception as e:
        _raise_if_platform_connect_unavailable(e)
        raise
    account_id = str(account["id"])
    get_db().table("vendors").update({"stripe_account_id": account_id}).eq(
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
                if vendor_has_payout_history(vendor_user_id):
                    logger.error(
                        "Connect onboarding blocked: orphan account but payout history "
                        "vendor=%s account=%s",
                        vendor_user_id,
                        account_id,
                    )
                    raise ServiceUnavailableError(
                        "Your payout account needs a manual review before reconnecting. "
                        "Please contact Eventtz support.",
                        code="stripe_connect_restore_required",
                    ) from e
                logger.warning(
                    "Stale Stripe Connect account vendor=%s account=%s - recreating",
                    vendor_user_id,
                    account_id,
                )
                if _clear_vendor_stripe_connect(
                    vendor_user_id,
                    trigger="connect_onboarding.retrieve",
                    stripe_error=str(e),
                ):
                    account_id = None
            elif isinstance(e, stripe.PermissionError):
                logger.error(
                    "Stripe PermissionError retrieving Connect account vendor=%s account=%s: %s",
                    vendor_user_id,
                    account_id,
                    e,
                )
                raise ServiceUnavailableError(
                    "We could not reach Stripe to verify your payout account. "
                    "Please try again shortly or contact support if this continues.",
                    code="stripe_connect_sync_failed",
                ) from e
            else:
                raise

    if not account_id:
        account_id = _create_connect_express_account(vendor_user_id, row)

    safe_path = _safe_connect_return_path(return_path)
    try:
        return _create_account_link_url(account_id, safe_path)
    except Exception as e:
        if not _is_orphan_connect_account_error(e):
            if isinstance(e, stripe.PermissionError):
                logger.error(
                    "Stripe PermissionError creating account link vendor=%s account=%s: %s",
                    vendor_user_id,
                    account_id,
                    e,
                )
                raise ServiceUnavailableError(
                    "We could not reach Stripe to continue payout setup. "
                    "Please try again shortly or contact support if this continues.",
                    code="stripe_connect_sync_failed",
                ) from e
            raise
        if vendor_has_payout_history(vendor_user_id):
            raise ServiceUnavailableError(
                "Your payout account needs a manual review before reconnecting. "
                "Please contact Eventtz support.",
                code="stripe_connect_restore_required",
            ) from e
        logger.warning(
            "Stripe rejected account link vendor=%s account=%s - recreating",
            vendor_user_id,
            account_id,
        )
        if _clear_vendor_stripe_connect(
            vendor_user_id,
            trigger="connect_onboarding.account_link",
            stripe_error=str(e),
        ):
            account_id = _create_connect_express_account(vendor_user_id, row)
        return _create_account_link_url(account_id, safe_path)


def _create_account_link_url(account_id: str, safe_path: str) -> str:
    settings = get_settings()
    try:
        link = _stripe().AccountLink.create(
            account=account_id,
            refresh_url=f"{settings.frontend_url}{safe_path}?stripe=refresh",
            return_url=f"{settings.frontend_url}{safe_path}?stripe=return",
            type="account_onboarding",
        )
    except Exception as e:
        _raise_if_platform_connect_unavailable(e)
        raise
    return str(link["url"])


def sync_connect_account_status(vendor_user_id: str) -> dict[str, Any]:
    """Fetch charges_enabled and payouts_enabled from Stripe and save them on the vendor row."""
    row = _get_vendor_row(vendor_user_id)
    if not row or not row.get("stripe_account_id"):
        return _connect_status_from_row(row)

    account_id = str(row.get("stripe_account_id") or "")

    try:
        account = stripe_object_to_dict(_stripe().Account.retrieve(account_id))
    except Exception as e:
        if _is_orphan_connect_account_error(e):
            logger.warning(
                "Stale Stripe Connect account vendor=%s account=%s - attempting clear",
                vendor_user_id,
                account_id,
            )
            if _clear_vendor_stripe_connect(
                vendor_user_id,
                trigger="sync_connect_account_status",
                stripe_error=str(e),
            ):
                return _connect_status_from_row(None)
            return _connect_status_from_row(row)
        if isinstance(e, stripe.PermissionError):
            logger.error(
                "Stripe PermissionError syncing Connect vendor=%s account=%s: %s",
                vendor_user_id,
                account_id,
                e,
            )
            return _connect_status_from_row(row)
        raise

    charges_enabled = bool(account.get("charges_enabled"))
    payouts_enabled = bool(account.get("payouts_enabled"))
    get_db().table("vendors").update(
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


def get_vendor_connect_status_response(vendor_user_id: str) -> dict[str, Any]:
    """Vendor-facing Connect status: read DB first; sync from Stripe only while onboarding."""
    row = _get_vendor_row(vendor_user_id)
    if not row or not row.get("stripe_account_id"):
        return _connect_status_from_row(row)
    if row.get("stripe_charges_enabled") and row.get("stripe_payouts_enabled"):
        return _connect_status_from_row(row)
    settings = get_settings()
    if not settings.stripe_secret_key.strip():
        return _connect_status_from_row(row)
    return sync_connect_account_status(vendor_user_id)


def restore_vendor_connect_from_payout_history(vendor_user_id: str) -> dict[str, Any]:
    """Recover stripe_account_id from the vendor's latest Stripe Transfer destination."""
    settings = get_settings()
    if not settings.stripe_secret_key.strip():
        raise ValueError(payment_messages.STRIPE_NOT_CONFIGURED)

    res = (
        get_db()
        .table("booking_requests")
        .select("stripe_transfer_id")
        .eq("vendor_user_id", vendor_user_id)
        .not_.is_("stripe_transfer_id", "null")
        .order("paid_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        raise ValueError(payment_messages.PAYOUT_TRANSFER_NOT_FOUND)
    transfer_id = str(rows[0].get("stripe_transfer_id") or "").strip()
    if not transfer_id:
        raise ValueError(payment_messages.PAYOUT_TRANSFER_NOT_FOUND)

    transfer = stripe_object_to_dict(_stripe().Transfer.retrieve(transfer_id))
    destination = str(transfer.get("destination") or "").strip()
    if not destination.startswith("acct_"):
        raise ValueError(payment_messages.CONNECT_ACCOUNT_RESOLVE_FAILED)

    account = stripe_object_to_dict(_stripe().Account.retrieve(destination))
    charges_enabled = bool(account.get("charges_enabled"))
    payouts_enabled = bool(account.get("payouts_enabled"))
    get_db().table("vendors").update(
        {
            "stripe_account_id": destination,
            "stripe_charges_enabled": charges_enabled,
            "stripe_payouts_enabled": payouts_enabled,
        },
    ).eq("user_id", vendor_user_id).execute()
    logger.info(
        "Restored Stripe Connect vendor=%s account=%s from transfer=%s",
        vendor_user_id,
        destination,
        transfer_id,
    )
    return {
        "stripe_account_id": destination,
        "charges_enabled": charges_enabled,
        "payouts_enabled": payouts_enabled,
        "restored_from_transfer_id": transfer_id,
    }


def refresh_pending_connect_flags(vendor_user_id: str, row: dict[str, Any]) -> dict[str, Any]:
    """Return `row` with its `stripe_*` columns refreshed, but only while onboarding is unfinished.

    `sync_connect_account_status` writes the fresh flags back to the vendor row, so every
    other reader of that vendor sees the corrected values without making its own Stripe
    call. Callers get a new dict; `row` is left untouched.

    Skipped - returning `row` unchanged - when there is nothing Stripe could tell us:
    offline development, no Stripe key, no Connect account yet, or an account that is
    already fully enabled (from then on the `account.updated` webhook keeps it current,
    and a call per page load would only add latency).
    """
    settings = get_settings()
    if not settings.stripe_secret_key.strip():
        return row
    if not row.get("stripe_account_id"):
        return row
    if row.get("stripe_charges_enabled") and row.get("stripe_payouts_enabled"):
        return row

    status = sync_connect_account_status(vendor_user_id)
    return {
        **row,
        "stripe_account_id": status["stripe_account_id"],
        "stripe_charges_enabled": status["charges_enabled"],
        "stripe_payouts_enabled": status["payouts_enabled"],
    }


def sync_connect_account_status_by_account_id(account_id: str) -> str | None:
    """Like sync_connect_account_status, but looked up by Stripe account id (for account.updated webhooks)."""
    res = (
        get_db()
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


def retrieve_charge(charge_id: str) -> Any:
    return _stripe().Charge.retrieve(charge_id)


def charge_receipt_url(charge_id: str | None) -> str | None:
    """Stripe-hosted card receipt URL, when available."""
    cid = str(charge_id or "").strip()
    if not cid.startswith("ch_"):
        return None
    try:
        raw = retrieve_charge(cid)
        ch = raw if isinstance(raw, dict) else stripe_object_to_dict(raw)
        url = ch.get("receipt_url")
        return str(url).strip() if url else None
    except Exception:
        logger.exception("Failed to retrieve Charge %s for receipt_url", cid)
        return None


class ReceiptVerificationError(Exception):
    """Stripe receipt verification failed (download-time check)."""

    def __init__(self, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.status_code = status_code


def verify_payment_for_receipt(
    *,
    payment_intent_id: str | None,
    expected_amount_gbp: float | None,
) -> None:
    """Re-fetch Stripe and confirm the payment still matches our frozen snapshot."""
    from app.features.bookings import messages as booking_messages

    pi_id = str(payment_intent_id or "").strip()
    if not pi_id.startswith("pi_"):
        raise ReceiptVerificationError(booking_messages.RECEIPT_STRIPE_VERIFY_FAILED, 404)

    try:
        pi_raw = retrieve_payment_intent(pi_id)
    except stripe.InvalidRequestError as exc:
        code = str(getattr(exc, "code", "") or "")
        if code == "resource_missing":
            # Common when Stripe keys were rotated or booking paid on another account.
            # Frozen snapshot + auth still gate the receipt; live verify is best-effort.
            logger.warning(
                "Receipt verify: PaymentIntent %s not in current Stripe account; "
                "serving from frozen snapshot",
                pi_id,
            )
            return
        logger.warning("Receipt verify: PaymentIntent.retrieve failed for %s: %s", pi_id, exc)
        raise ReceiptVerificationError(
            booking_messages.RECEIPT_STRIPE_VERIFY_FAILED,
            503,
        ) from exc
    except stripe.StripeError as exc:
        logger.warning("Receipt verify: PaymentIntent.retrieve failed for %s: %s", pi_id, exc)
        raise ReceiptVerificationError(
            booking_messages.RECEIPT_STRIPE_VERIFY_FAILED,
            503,
        ) from exc

    pi = pi_raw if isinstance(pi_raw, dict) else stripe_object_to_dict(pi_raw)
    if str(pi.get("status") or "") != "succeeded":
        raise ReceiptVerificationError("Payment is not completed", 403)

    if expected_amount_gbp is None:
        return

    try:
        amount_received_pence = int(pi.get("amount_received") or 0)
        expected_pence = _to_pence(float(expected_amount_gbp))
    except (TypeError, ValueError) as exc:
        raise ReceiptVerificationError(
            booking_messages.RECEIPT_STRIPE_VERIFY_FAILED,
            503,
        ) from exc

    if amount_received_pence != expected_pence:
        logger.warning(
            "Receipt verify amount mismatch pi=%s stored_gbp=%s stripe_pence=%s expected_pence=%s",
            pi_id,
            expected_amount_gbp,
            amount_received_pence,
            expected_pence,
        )
        raise ReceiptVerificationError(
            booking_messages.RECEIPT_STRIPE_VERIFY_FAILED,
            503,
        )


def resolve_source_charge_id(
    *,
    charge_id: str | None,
    payment_intent_id: str | None,
) -> str | None:
    """Return the Stripe Charge id to fund a delayed Connect Transfer.

    Transfers without ``source_transaction`` draw from the platform's available
    balance, which fails when automatic payouts have already swept the Checkout
    charge. Linking the transfer to the original charge avoids that.
    """
    cid = str(charge_id or "").strip()
    if cid.startswith("ch_"):
        return cid
    pi_id = str(payment_intent_id or "").strip()
    if not pi_id.startswith("pi_"):
        return None
    try:
        pi = retrieve_payment_intent(pi_id)
        pi_dict = pi if isinstance(pi, dict) else stripe_object_to_dict(pi)
        latest_charge = pi_dict.get("latest_charge")
        if isinstance(latest_charge, dict):
            out = latest_charge.get("id")
            return str(out) if out else None
        if isinstance(latest_charge, str) and latest_charge.startswith("ch_"):
            return latest_charge
    except Exception:
        logger.exception("Failed to resolve charge from PaymentIntent %s", pi_id)
    return None


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


def _transfer_idempotency_key(
    *,
    booking_id: str,
    amount_pence: int,
    destination: str,
    source_transaction: str | None,
) -> str:
    """Stripe keys are bound to exact params - include funding source so charge-backed retries
    don't collide with an earlier failed platform-balance attempt for the same booking."""
    base = f"transfer-{booking_id}-{amount_pence}-{destination}"
    src = str(source_transaction or "").strip()
    if src.startswith("ch_"):
        return f"{base}-src-{src}"
    return base


def create_transfer(
    *,
    destination_account_id: str,
    amount_gbp: float,
    booking_id: str,
    source_transaction: str | None = None,
) -> str:
    """Pay the vendor from the client's Checkout charge into their Connect account.

    When ``source_transaction`` is set (the booking's ``stripe_charge_id``), Stripe
    funds the transfer from that charge even if the platform balance is empty because
    automatic payouts already swept it. Without it, the transfer needs available
    platform balance and can fail with "insufficient funds".

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
        raise ValueError(payment_messages.TRANSFER_MIN_AMOUNT)
    dest = destination_account_id.strip()
    src = str(source_transaction or "").strip()
    charge_id = src if src.startswith("ch_") else None
    create_kwargs: dict[str, Any] = {
        "amount": amount_pence,
        "currency": "gbp",
        "destination": dest,
        "transfer_group": f"booking_{booking_id}",
        "metadata": {"booking_id": booking_id},
        "idempotency_key": _transfer_idempotency_key(
            booking_id=booking_id,
            amount_pence=amount_pence,
            destination=dest,
            source_transaction=charge_id,
        ),
    }
    if charge_id:
        create_kwargs["source_transaction"] = charge_id
    try:
        transfer = _stripe().Transfer.create(**create_kwargs)
        return str(transfer["id"])
    except stripe.IdempotencyError:
        reclaimed = find_existing_transfer_id(booking_id)
        if reclaimed:
            return reclaimed
        raise


def expire_checkout_session(session_id: str | None) -> None:
    """Best-effort close of an open Checkout Session so a cancelled booking cannot still be paid."""
    sid = str(session_id or "").strip()
    if not sid.startswith("cs_"):
        return
    try:
        _stripe().checkout.Session.expire(sid)
    except stripe.InvalidRequestError as e:
        logger.info("checkout session expire skipped session=%s: %s", sid, e)
    except Exception:
        logger.exception("checkout session expire failed session=%s", sid)


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
