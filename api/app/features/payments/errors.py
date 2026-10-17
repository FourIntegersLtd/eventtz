"""Errors the payments slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import BadGateway, InvalidInput, Unavailable


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


class StripeWebhookHandlerFailed(Unavailable):
    """A verified webhook's handler failed; the 503 makes Stripe redeliver the event later."""

    code = "stripe_webhook_handler_failed"
    default_message = "The webhook could not be processed; Stripe will retry it."


class StripeConnectSyncFailed(Unavailable):
    """Stripe refused to show the vendor's Connect account (a permission error), so setup cannot go on."""

    code = "stripe_connect_sync_failed"
    default_message = (
        "We could not reach Stripe to verify your payout account. "
        "Please try again shortly or contact support if this continues."
    )


class StripeNotConfigured(InvalidInput):
    """No Stripe key is set, so staff cannot ask Stripe to restore a vendor's Connect account."""

    code = "stripe_not_configured"
    default_message = "Stripe is not configured."


class PayoutTransferNotFound(InvalidInput):
    """The vendor was never paid out by Stripe Transfer, so there is no Connect account to recover."""

    code = "payout_transfer_not_found"
    default_message = "No payout transfer found for this vendor."


class ConnectAccountResolveFailed(InvalidInput):
    """The vendor's latest Transfer names no `acct_` destination."""

    code = "connect_account_resolve_failed"
    default_message = "Could not resolve Connect account from the payout transfer."


class StripeConnectRestoreFailed(BadGateway):
    """Anything else went wrong while restoring Connect (usually Stripe); the baseline answers 502."""

    code = "stripe_connect_restore_failed"
    default_message = "Could not restore Stripe Connect."


# The account-link step's wording of the same failure.
CONNECT_LINK_SYNC_FAILED_MESSAGE = (
    "We could not reach Stripe to continue payout setup. "
    "Please try again shortly or contact support if this continues."
)
