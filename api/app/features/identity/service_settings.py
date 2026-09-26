"""Account settings: contact sharing (clients and vendors) and client first-visit onboarding."""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.auth import Principal
from app.features.identity import repository
from app.features.identity.domain_accounts import contact_settings_changes, onboarding_changes
from app.features.identity.schemas import (
    ClientOnboardingPatchBody,
    ClientOnboardingState,
    ContactSharingSettings,
    ContactSharingSettingsPutBody,
)


def contact_settings(user_id: str) -> ContactSharingSettings:
    """The saved settings; everything shared (and no phone) until the user changes them."""
    row = repository.get_contact_settings(user_id)
    if row is None:
        return ContactSharingSettings()
    return ContactSharingSettings(
        contact_phone=row.contact_phone,
        share_email=row.share_email is not False,
        share_phone=row.share_phone is not False,
        share_address=row.share_address is not False,
    )


def update_contact_settings(
    principal: Principal, body: ContactSharingSettingsPutBody
) -> ContactSharingSettings:
    """Save the fields sent (vendors cannot set phone or address here) and return the result."""
    changes = contact_settings_changes(
        user_type=principal.user_type,
        contact_phone=body.contact_phone,
        share_email=body.share_email,
        share_phone=body.share_phone,
        share_address=body.share_address,
    )
    if changes:
        repository.update_profile(principal.id, changes)
    return contact_settings(principal.id)


def client_onboarding(user_id: str) -> ClientOnboardingState:
    """Whether the client finished first-visit setup, and their preferred name."""
    profile = repository.get_profile(user_id)
    if profile is None:
        return ClientOnboardingState()
    return ClientOnboardingState(
        completed=bool(profile.client_onboarding_completed_at),
        preferred_name=(profile.preferred_name or "").strip() or None,
    )


def update_client_onboarding(user_id: str, body: ClientOnboardingPatchBody) -> ClientOnboardingState:
    """Save the preferred name and/or mark onboarding done, and return the result."""
    changes = onboarding_changes(
        preferred_name=body.preferred_name, mark_completed=bool(body.mark_completed), now=datetime.now(UTC)
    )
    if changes:
        repository.update_profile(user_id, changes)
    return client_onboarding(user_id)
