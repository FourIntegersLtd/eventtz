"""Errors the copilot slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput


class QuestionRequired(InvalidInput):
    """The vendor asked the co-pilot a whitespace-only question.

    `CopilotAskRequest.question` only rejects the literal empty string (`min_length=1`);
    a blank-but-not-empty question reaches the route and is caught here instead, with a
    different status than the schema's 422 for the literal empty string (baseline quirk).
    """

    code = "copilot_question_required"
    default_message = "Question is required."
