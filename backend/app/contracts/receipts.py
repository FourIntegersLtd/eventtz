"""Payment receipt and vendor statement API contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ReceiptDocumentType = Literal[
    "client_payment_receipt",
    "vendor_payment_record",
    "vendor_payout_statement",
]


class ReceiptLineItem(BaseModel):
    label: str
    amount_label: str


class PaymentReceiptPayload(BaseModel):
    document_type: ReceiptDocumentType
    receipt_number: str
    booking_id: str = Field(
        validation_alias="booking_request_id",
        serialization_alias="booking_request_id",
    )
    event_name: str
    event_date: str
    payment_status: str
    paid_at: str | None = None
    payout_released_at: str | None = None
    counterparty_name: str
    line_items: list[ReceiptLineItem] = Field(default_factory=list)
    subtotal_label: str | None = None
    service_fee_label: str | None = None
    service_fee_percent: float | None = None
    total_label: str
    vendor_share_label: str | None = None
    platform_fee_label: str | None = None
    payment_reference: str | None = None
    transfer_reference: str | None = None
    stripe_receipt_url: str | None = None
    status_note: str | None = None

    model_config = {"populate_by_name": True}


class PaymentReceiptResponse(BaseModel):
    success: bool = True
    receipt: PaymentReceiptPayload
