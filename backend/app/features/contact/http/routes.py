"""Signed-in contact form endpoints for clients and vendors."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.contracts.contact import ContactSubmitBody, ContactSubmitResponse
from app.features.auth.http.guards import require_client, require_vendor
from app.features.contact.service import submit_contact_message

client_router = APIRouter(prefix="/client", tags=["client"])
vendor_router = APIRouter(prefix="/vendor", tags=["vendor"])


def _handle_submit(
    *,
    user_id: str,
    portal: str,
    body: ContactSubmitBody,
) -> ContactSubmitResponse:
    try:
        submit_contact_message(
            user_id=user_id,
            portal=portal,
            subject=body.subject,
            message=body.message,
            booking_id=body.booking_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ContactSubmitResponse(success=True)


@client_router.post("/contact", response_model=ContactSubmitResponse)
def post_client_contact(
    body: ContactSubmitBody,
    request: Request,
    response: Response,
) -> ContactSubmitResponse:
    user = require_client(request, response)
    return _handle_submit(
        user_id=str(user.get("id") or ""),
        portal="client",
        body=body,
    )


@vendor_router.post("/contact", response_model=ContactSubmitResponse)
def post_vendor_contact(
    body: ContactSubmitBody,
    request: Request,
    response: Response,
) -> ContactSubmitResponse:
    user = require_vendor(request, response)
    return _handle_submit(
        user_id=str(user.get("id") or ""),
        portal="vendor",
        body=body,
    )
