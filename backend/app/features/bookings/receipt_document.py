"""Render payment receipt documents as server-generated HTML."""

from __future__ import annotations

from typing import Any

from fastapi import Response
from pydantic import ValidationError

from app.contracts.receipts import PaymentReceiptPayload, PaymentReceiptResponse
from app.features.bookings import messages as booking_messages
from app.features.bookings.receipts import receipt_context_for_email
from app.features.email.render import render_template


def payment_receipt_response(payload: dict[str, Any]) -> PaymentReceiptResponse:
    try:
        return PaymentReceiptResponse(receipt=PaymentReceiptPayload(**payload))
    except ValidationError as e:
        raise ValueError(booking_messages.RECEIPT_NOT_AVAILABLE) from e


def receipt_html_bytes(payload: dict) -> bytes:
    ctx = receipt_context_for_email(payload)
    html = render_template("booking/receipt_document.html", ctx)
    return html.encode("utf-8")


def receipt_html_response(
    payload: dict,
    *,
    filename: str,
    inline: bool = False,
) -> Response:
    """Return a FastAPI Response with server-generated HTML bytes."""
    body = receipt_html_bytes(payload)
    disposition = "inline" if inline else "attachment"
    return Response(
        content=body,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )
