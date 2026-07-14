"""Super-admin email template testing."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AdminEmailTemplateRow(BaseModel):
    id: str
    label: str
    category: str
    description: str | None = None


class AdminEmailTemplatesListResponse(BaseModel):
    success: bool = True
    templates: list[AdminEmailTemplateRow]


class AdminEmailTestSendBody(BaseModel):
    template_id: str = Field(min_length=1, max_length=120)
    to_email: str = Field(min_length=3, max_length=320)


class AdminEmailTestSendResponse(BaseModel):
    success: bool
    delivered: bool
    message: str | None = None
