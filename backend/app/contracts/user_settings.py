from pydantic import BaseModel, Field


class ContactSharingSettings(BaseModel):
    contact_phone: str | None = None
    share_email: bool = True
    share_phone: bool = True
    share_address: bool = True


class ContactSharingSettingsResponse(BaseModel):
    success: bool = True
    settings: ContactSharingSettings


class ContactSharingSettingsPutBody(BaseModel):
    contact_phone: str | None = Field(None, max_length=40)
    share_email: bool | None = None
    share_phone: bool | None = None
    share_address: bool | None = None


class ClientOnboardingState(BaseModel):
    completed: bool = False
    preferred_name: str | None = None


class ClientOnboardingResponse(BaseModel):
    success: bool = True
    onboarding: ClientOnboardingState


class ClientOnboardingPatchBody(BaseModel):
    preferred_name: str | None = Field(None, max_length=80)
    mark_completed: bool | None = None
