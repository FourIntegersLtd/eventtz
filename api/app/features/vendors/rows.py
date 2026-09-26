"""Typed rows the vendors repository returns. Only the repository builds them; schemas never import them.

Plain values (text ids, ISO timestamps): the shape the domain rules and goldens
were written against. The mapped tables are in `models.py`."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class VendorRow(BaseModel):
    """A `vendors` row: onboarding progress, the profile form, approval, and the listing inputs."""

    id: str | None = None
    user_id: str
    status: str | None = None
    approval_status: str | None = None
    current_step: int | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None
    stripe_account_id: str | None = None
    stripe_charges_enabled: bool | None = None
    stripe_payouts_enabled: bool | None = None
    listing_override: str | None = None
    listing_override_reason: str | None = None

    @field_validator("payload", mode="before")
    @classmethod
    def _payload_is_a_form(cls, raw_payload: Any) -> dict[str, Any]:
        """A missing or malformed form reads as an empty one."""
        return raw_payload if isinstance(raw_payload, dict) else {}
