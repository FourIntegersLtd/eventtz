"""Errors the payments slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, Unavailable


class MissingStripeSignature(InvalidInput):
    """A webhook arrived without the `Stripe-Signature` header."""

    code = "missing_stripe_signature"
    default_message = "Missing Stripe-Signature header."


class InvalidStripeSignature(InvalidInput):
    """The webhook's signature does not match the signing secret (or is stale, or no secret is set)."""

    code = "invalid_stripe_signature"
    default_message = "Invalid signature."


class StripeConnectUnavailable(Unavailable):
    """Eventtz's own Stripe platform account cannot create Connect accounts yet."""

    code = "stripe_connect_unavailable"
    default_message = (
        "Payout setup is temporarily unavailable while we finish payment setup on Eventtz. "
        "Please try again in a little while, or contact support if this continues."
    )


class StripeConnectRestoreRequired(Unavailable):
    """The stored Connect account is gone, but the vendor was paid through it, so staff must look first."""

    code = "stripe_connect_restore_required"
    default_message = (
        "Your payout account needs a manual review before reconnecting. Please contact Eventtz support."
    )


class StripeConnectSyncFailed(Unavailable):
    """Stripe refused to show the vendor's Connect account (a permission error), so setup cannot go on."""

    code = "stripe_connect_sync_failed"
    default_message = (
        "We could not reach Stripe to verify your payout account. "
        "Please try again shortly or contact support if this continues."
    )


# The account-link step's wording of the same failure.
CONNECT_LINK_SYNC_FAILED_MESSAGE = (
    "We could not reach Stripe to continue payout setup. "
    "Please try again shortly or contact support if this continues."
)
