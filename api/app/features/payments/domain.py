"""Pure payments rules: Stripe webhook signatures and vendor payout (Connect) setup helpers.

Nothing here talks to Stripe or the database. The services feed it raw bytes, rows
and `PaymentGatewayError`s, and act on what it decides.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
from dataclasses import dataclass, field
from typing import Any

from app.core.ports import PaymentGatewayError

# Stripe's own SDK default: a signed event older than five minutes is treated as a replay.
WEBHOOK_TOLERANCE_SECONDS = 300

DEFAULT_CONNECT_RETURN_PATH = "/vendor/payments"
_BOOKING_RETURN_PREFIX = "/vendor/bookings/"
# Booking ids are UUIDs (36 characters); 64 leaves room without letting a path through.
_MAX_BOOKING_ID_LENGTH = 64

# Stripe's wording when a stored `acct_…` is gone or belongs to another platform.
_ORPHAN_ACCOUNT_MARKERS = (
    "not connected to your platform",
    "does not exist",
    "does not have access to account",
    "no such account",
)
# Stripe's wording when Eventtz's own platform account cannot create Connect accounts yet.
_PLATFORM_SETUP_MARKERS = (
    "must be activated",
    "complete your account setup",
    "complete your platform profile",
    "platform profile",
    "create live connected accounts",
    "connect/accounts/overview",
    "connect is not enabled",
    "signed up for connect",
)
# Stripe answers an `invalid_request_error` with 400, or 404 for a missing object.
_INVALID_REQUEST_STATUSES = (400, 404)
_PERMISSION_STATUS = 403


# --- webhook signatures ------------------------------------------------------------------------------


def parse_signature_header(signature_header: str) -> tuple[int | None, list[str]]:
    """Split `Stripe-Signature` (`t=…,v1=…,v1=…`) into its timestamp and every `v1` signature.

    Stripe sends several `v1` entries while a signing secret is being rolled, so all are kept.
    An unreadable timestamp comes back as None.
    """
    timestamp: int | None = None
    signatures: list[str] = []
    for part in signature_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            try:
                timestamp = int(value)
            except ValueError:
                timestamp = None
        elif key == "v1" and value:
            signatures.append(value)
    return timestamp, signatures


def expected_signature(payload: bytes, *, timestamp: int, secret: str) -> str:
    """Stripe's scheme: hex HMAC-SHA256 of `"{timestamp}.{raw body}"` under the endpoint secret."""
    signed_payload = str(timestamp).encode() + b"." + payload
    return hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()


def webhook_signature_is_valid(
    payload: bytes,
    signature_header: str,
    secret: str,
    *,
    now_seconds: int,
    tolerance_seconds: int = WEBHOOK_TOLERANCE_SECONDS,
) -> bool:
    """True when one `v1` signature matches and the timestamp is within the tolerance window.

    An empty secret always fails: with no secret configured nothing can be verified, and
    accepting unsigned events would let anyone mark a booking paid.
    """
    if not secret:
        return False
    timestamp, signatures = parse_signature_header(signature_header)
    if timestamp is None or not signatures:
        return False
    if abs(now_seconds - timestamp) > tolerance_seconds:
        return False
    wanted = expected_signature(payload, timestamp=timestamp, secret=secret)
    return any(hmac.compare_digest(wanted, signature) for signature in signatures)


def parse_webhook_event(payload: bytes) -> dict[str, Any] | None:
    """The event JSON as a dict, or None when the (already verified) body is not a JSON object."""
    try:
        event = json.loads(payload)
    except ValueError:
        return None
    return event if isinstance(event, dict) else None


def webhook_event_object(event: dict[str, Any]) -> dict[str, Any]:
    """The Stripe object the event is about (`data.object`), or an empty dict."""
    data = event.get("data")
    if isinstance(data, dict) and isinstance(data.get("object"), dict):
        return dict(data["object"])
    return {}


# --- Connect onboarding ------------------------------------------------------------------------------


def safe_connect_return_path(return_path: str) -> str:
    """Allowlist where Stripe may send a vendor back after onboarding.

    Stripe's redirect URLs must not become an open redirect, so only Payments and the
    accept-time resume (`/vendor/bookings/{id}`) are allowed; anything else is Payments.
    """
    path = (return_path or "").strip() or DEFAULT_CONNECT_RETURN_PATH
    if path in (DEFAULT_CONNECT_RETURN_PATH, "/vendor/onboarding"):
        # /vendor/onboarding redirects to the profile page; Payments is where setup resumes.
        return DEFAULT_CONNECT_RETURN_PATH
    if path.startswith(_BOOKING_RETURN_PREFIX):
        booking_id = path[len(_BOOKING_RETURN_PREFIX) :].split("?", 1)[0].strip("/")
        if booking_id and "/" not in booking_id and len(booking_id) <= _MAX_BOOKING_ID_LENGTH:
            return f"{_BOOKING_RETURN_PREFIX}{booking_id}"
    return DEFAULT_CONNECT_RETURN_PATH


def normalise_phone_for_stripe(phone: str | None) -> str | None:
    """Best-effort E.164 for prefill; None for anything we cannot convert with confidence.

    Stripe rejects a malformed phone number and fails the whole account creation, so an
    unrecognised format is left blank for the vendor to fill in on Stripe's own form.
    """
    trimmed = (phone or "").strip()
    if not trimmed:
        return None
    digits = re.sub(r"\D", "", trimmed)
    if trimmed.startswith("+"):
        return f"+{digits}" if digits else None
    # A UK national number: 0 followed by 9-10 digits becomes +44 without the 0.
    if trimmed.startswith("0") and 10 <= len(digits) <= 11:
        return f"+44{digits[1:]}"
    return None


@dataclass(frozen=True)
class ConnectPrefill:
    """What Eventtz already knows about a vendor, sent when their Express account is created.

    Stripe only accepts these at creation: afterwards the platform may not edit an
    Express account's identity, only the vendor can, on Stripe's own pages.
    """

    email: str | None
    individual: dict[str, Any] = field(default_factory=dict)
    business_profile: dict[str, Any] = field(default_factory=dict)


def _payload_text(payload: dict[str, Any], key: str) -> str | None:
    """A trimmed, non-empty string from the vendor payload, else None."""
    value = payload.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def connect_prefill(email: str | None, payload: dict[str, Any] | None) -> ConnectPrefill:
    """Build the Express account prefill from the vendor's email and profile payload."""
    profile = payload if isinstance(payload, dict) else {}
    individual: dict[str, Any] = {}
    if email:
        individual["email"] = email
    for payload_key, stripe_key in (("firstName", "first_name"), ("lastName", "last_name")):
        value = _payload_text(profile, payload_key)
        if value:
            individual[stripe_key] = value
    phone = normalise_phone_for_stripe(_payload_text(profile, "phone"))
    if phone:
        individual["phone"] = phone

    address: dict[str, Any] = {}
    for payload_key, stripe_key in (("baseCity", "city"), ("region", "state"), ("postalCode", "postal_code")):
        value = _payload_text(profile, payload_key)
        if value:
            address[stripe_key] = value
    if address:
        address["country"] = "GB"
        individual["address"] = address

    business_name = _payload_text(profile, "businessName")
    business_profile = {"name": business_name} if business_name else {}
    return ConnectPrefill(email=email or None, individual=individual, business_profile=business_profile)


def connect_link_urls(frontend_url: str, safe_path: str) -> tuple[str, str]:
    """The (refresh, return) URLs for an onboarding link back to `safe_path`."""
    base = f"{frontend_url}{safe_path}"
    return f"{base}?stripe=refresh", f"{base}?stripe=return"


# --- reading Stripe's refusals -----------------------------------------------------------------------


def is_permission_error(error: PaymentGatewayError) -> bool:
    """Stripe answered 403: often a test/live key mismatch, never proof the account is gone."""
    return error.http_status == _PERMISSION_STATUS


def is_orphan_account_error(error: PaymentGatewayError) -> bool:
    """True only when Stripe says the stored `acct_…` is gone or not on this platform.

    A permission error alone is not an orphan: it usually means a key mismatch, and
    treating it as one would wipe a vendor who has already been paid.
    """
    if error.http_status not in _INVALID_REQUEST_STATUSES:
        return False
    message = error.message.lower()
    return any(marker in message for marker in _ORPHAN_ACCOUNT_MARKERS)


def is_platform_setup_error(error: PaymentGatewayError) -> bool:
    """True when Eventtz's own Stripe platform is not yet able to create Connect accounts."""
    message = error.message.lower()
    if error.http_status in _INVALID_REQUEST_STATUSES:
        return any(marker in message for marker in _PLATFORM_SETUP_MARKERS)
    if is_permission_error(error):
        return "connect" in message and "platform" in message
    return False
