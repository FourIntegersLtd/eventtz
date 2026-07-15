"""Shared types for AI help during vendor signup (bio writing and photo checks)."""

from typing import Any

from pydantic import BaseModel, Field


class GenerateVendorBioBody(BaseModel):
    """Profile details sent to the AI; we remove private fields before calling it."""

    payload: dict[str, Any] = Field(default_factory=dict)


class GenerateVendorBioResponse(BaseModel):
    bio: str


class AnalyzePortfolioImageResponse(BaseModel):
    ok: bool
    score: int = Field(ge=1, le=5)
    summary: str
