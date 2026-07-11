from typing import Any

from pydantic import BaseModel, Field


class GenerateVendorBioBody(BaseModel):
    """Vendor profile JSON; server strips sensitive fields before calling the model."""

    payload: dict[str, Any] = Field(default_factory=dict)


class GenerateVendorBioResponse(BaseModel):
    bio: str


class AnalyzePortfolioImageResponse(BaseModel):
    ok: bool
    score: int = Field(ge=1, le=5)
    summary: str
