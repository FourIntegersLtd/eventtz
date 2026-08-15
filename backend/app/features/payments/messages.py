"""User-facing payments / Stripe copy."""

from __future__ import annotations

STRIPE_NOT_CONFIGURED = "Stripe is not configured."
PAYOUT_TRANSFER_NOT_FOUND = "No payout transfer found for this vendor."
CONNECT_ACCOUNT_RESOLVE_FAILED = "Could not resolve Connect account from the payout transfer."
TRANSFER_MIN_AMOUNT = "Transfer amount must be at least £0.01."
MISSING_STRIPE_SIGNATURE = "Missing Stripe-Signature header."
INVALID_STRIPE_SIGNATURE = "Invalid signature."
