"""Admin booking payment field patches."""

from __future__ import annotations

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.payments import stripe as stripe_service

logger = get_logger(__name__)


def patch_booking_payment_fields(booking_id: str, fields: dict[str, Any]) -> bool:
    """
    Update Stripe / payment snapshot columns.
    payment_amount_gbp is always derived from Stripe when a payment intent is provided.
    """
    if get_settings().local_auth_mode:
        return False
    try:
        uuid.UUID(booking_id)
    except ValueError:
        return False

    allowed = {"stripe_payment_intent_id", "stripe_charge_id", "payment_amount_gbp"}
    patch: dict[str, Any] = {}
    for k in allowed:
        if k in fields:
            patch[k] = fields[k]

    if not patch:
        return True

    pi_id = patch.get("stripe_payment_intent_id")
    if pi_id is not None:
        pi_id = str(pi_id).strip() or None
        patch["stripe_payment_intent_id"] = pi_id

    charge_id = patch.get("stripe_charge_id")
    if charge_id is not None:
        charge_id = str(charge_id).strip() or None
        patch["stripe_charge_id"] = charge_id

    if "payment_amount_gbp" in patch or pi_id is not None or charge_id is not None:
        existing_res = (
            get_client()
            .table("booking_requests")
            .select("stripe_payment_intent_id")
            .eq("id", booking_id)
            .limit(1)
            .execute()
        )
        existing_rows = getattr(existing_res, "data", None) or []
        existing_pi = None
        if existing_rows and isinstance(existing_rows[0], dict):
            existing_pi = existing_rows[0].get("stripe_payment_intent_id")

        resolved_pi = pi_id or (str(existing_pi).strip() if existing_pi else None)
        if not resolved_pi:
            raise ValueError(
                "stripe_payment_intent_id is required to set payment_amount_gbp.",
            )
        try:
            pi_raw = stripe_service.retrieve_payment_intent(resolved_pi)
            pi = stripe_service.stripe_object_to_dict(pi_raw)
        except Exception as e:
            logger.exception("patch_booking_payment_fields stripe retrieve failed")
            raise ValueError(
                "Could not verify payment with Stripe. Try again later.",
            ) from e

        amount_received = pi.get("amount_received")
        pi_status = str(pi.get("status") or "").strip().lower()
        if amount_received is None or (
            isinstance(amount_received, (int, float)) and float(amount_received) <= 0
        ):
            if pi_status in ("succeeded", "requires_capture") and pi.get("amount") is not None:
                amount_received = pi.get("amount")
            else:
                amount_received = None
        if not isinstance(amount_received, (int, float)) or float(amount_received) <= 0:
            raise ValueError("Stripe payment intent has no confirmed amount.")
        patch["payment_amount_gbp"] = round(float(amount_received) / 100.0, 2)
        patch["stripe_payment_intent_id"] = resolved_pi

        if charge_id:
            latest = pi.get("latest_charge")
            if isinstance(latest, dict):
                stripe_charge = latest.get("id")
            else:
                stripe_charge = latest
            if not stripe_charge:
                raise ValueError(
                    "Could not verify stripe_charge_id — payment intent has no charge yet.",
                )
            if str(stripe_charge) != charge_id:
                raise ValueError("stripe_charge_id does not match the payment intent.")

    final_patch: dict[str, Any] = {}
    for k in allowed:
        if k in patch:
            v = patch[k]
            if k == "payment_amount_gbp":
                final_patch[k] = v
            else:
                final_patch[k] = (v or None) if v is not None else None

    if not final_patch:
        return True

    try:
        get_client().table("booking_requests").update(final_patch).eq("id", booking_id).execute()
        return True
    except Exception as e:
        if "stripe_payment_intent_id" in str(e).lower() or "42703" in str(e):
            logger.warning("patch_booking_payment_fields: run migration 018 — %s", e)
            return False
        logger.warning("patch_booking_payment_fields failed: %s", e, exc_info=True)
        return False
