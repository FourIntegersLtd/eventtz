"""Shared types for contact form submissions."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ContactSubject = Literal[
    "general",
    "booking_problem",
    "payments",
    "account",
    "other",
    "feedback_bug",
    "feedback_feature",
    "feedback_general",
    "feedback_other",
]

CONTACT_SUBJECT_LABELS: dict[str, str] = {
    "general": "General",
    "booking_problem": "Booking problem",
    "payments": "Payments",
    "account": "Account",
    "other": "Other",
    "feedback_bug": "Bug report",
    "feedback_feature": "Feature idea",
    "feedback_general": "General feedback",
    "feedback_other": "Other feedback",
}


class ContactSubmitBody(BaseModel):
    subject: ContactSubject
    message: str = Field(min_length=10, max_length=5000)
    booking_id: str | None = None


class ContactSubmitResponse(BaseModel):
    success: bool = True
