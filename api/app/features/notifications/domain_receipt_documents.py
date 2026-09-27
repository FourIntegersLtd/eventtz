"""Headlines for receipt HTML documents (mirrors bookings receipt email context)."""

from __future__ import annotations

from typing import Any


def receipt_document_context(payload: dict[str, Any]) -> dict[str, Any]:
    """The headline and subtitle the receipt HTML template shows."""
    document_type = str(payload.get("document_type") or "")
    if document_type == "client_payment_receipt":
        headline, subtitle = "Your payment receipt", f"Receipt {payload.get('receipt_number', '')}"
    elif document_type == "vendor_payment_record":
        headline, subtitle = "Payment received", f"Record {payload.get('receipt_number', '')}"
    else:
        headline, subtitle = "Payout statement", f"Statement {payload.get('receipt_number', '')}"
    return {"headline": headline, "subtitle": subtitle, "receipt": payload}
