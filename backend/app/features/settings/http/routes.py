"""Account contact-sharing settings (clients and vendors)."""

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_user
from app.contracts.user_settings import (
    AccountDeletionBody,
    AccountDeletionResponse,
    ContactSharingSettings,
    ContactSharingSettingsPutBody,
    ContactSharingSettingsResponse,
)
from app.features.auth.session import clear_session_cookies
from app.features.settings.account_deletion import delete_own_account
from app.features.settings.contact import get_contact_settings, update_contact_settings
from app.features.settings import messages as settings_messages

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/contact-settings", response_model=ContactSharingSettingsResponse)
def get_user_contact_settings(request: Request, response: Response) -> ContactSharingSettingsResponse:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    raw = get_contact_settings(uid)
    return ContactSharingSettingsResponse(
        settings=ContactSharingSettings(
            contact_phone=raw.get("contact_phone"),
            share_email=bool(raw.get("share_email", True)),
            share_phone=bool(raw.get("share_phone", True)),
            share_address=bool(raw.get("share_address", True)),
        ),
    )


@router.put("/contact-settings", response_model=ContactSharingSettingsResponse)
def put_user_contact_settings(
    request: Request,
    response: Response,
    body: ContactSharingSettingsPutBody,
) -> ContactSharingSettingsResponse:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    user_type = str(user.get("user_type") or "client")
    raw = update_contact_settings(
        uid,
        user_type=user_type,
        contact_phone=body.contact_phone,
        share_email=body.share_email,
        share_phone=body.share_phone,
        share_address=body.share_address,
    )
    return ContactSharingSettingsResponse(
        settings=ContactSharingSettings(
            contact_phone=raw.get("contact_phone"),
            share_email=bool(raw.get("share_email", True)),
            share_phone=bool(raw.get("share_phone", True)),
            share_address=bool(raw.get("share_address", True)),
        ),
    )


@router.post("/account/deletion", response_model=AccountDeletionResponse)
def delete_own_user_account(
    request: Request,
    response: Response,
    body: AccountDeletionBody,
) -> AccountDeletionResponse:
    user = require_user(request, response)
    uid = str(user.get("id") or "")
    delete_own_account(user_id=uid, password=body.password)
    clear_session_cookies(response)
    return AccountDeletionResponse(success=True, message=settings_messages.ACCOUNT_DELETED)
