"""Errors are exceptions, and the type carries the HTTP status (ADR 0004).

Services raise an `AppError` subclass; one handler renders it as
`{"detail": message, "code": code}`. `detail` stays a string so clients built
against the baseline API keep working. Clients branch on `code`, never on text.

Slices subclass these for their own vocabulary:
`class PostNotFound(NotFound): code = "post_not_found"`.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.logging import get_logger


class ErrorResponse(BaseModel):
    """The JSON body of every error response, and its OpenAPI schema."""

    detail: str
    code: str


class AppError(Exception):
    """Base for every error a service raises. Subclasses set `status`, `code` and `default_message`."""

    status: int = 500
    code: str = "internal_error"
    default_message: str = "Something went wrong"
    # A few failures must record something anyway — e.g. revoking a refresh chain
    # proven to have leaked, while still answering 401. Such an error sets this,
    # and `core.db.get_session` commits instead of rolling back (copied from OSCE).
    persist_effects: bool = False

    def __init__(self, message: str | None = None) -> None:
        """Use `message` as the user-facing `detail`, or the class's `default_message`."""
        self.message = message or self.default_message
        super().__init__(self.message)


class InvalidInput(AppError):
    """400: the request breaks a business rule (shape errors are FastAPI's 422)."""

    status = 400
    code = "invalid_input"
    default_message = "The request was not valid"


class InvalidBookingId(InvalidInput):
    """The booking id in the path is not a UUID, rejected before any lookup (bookings and disputes)."""

    code = "invalid_booking_id"
    default_message = "Invalid booking id."


class NoFieldsToUpdate(InvalidInput):
    """A PATCH body with every field left out; there is nothing to change."""

    code = "no_fields_to_update"
    default_message = "No fields to update"


class Unauthenticated(AppError):
    """401: no valid session."""

    status = 401
    code = "unauthenticated"
    default_message = "Please sign in to continue."


class Forbidden(AppError):
    """403: signed in, but not allowed to do this."""

    status = 403
    code = "forbidden"
    default_message = "You do not have access to this resource"


class NotFound(AppError):
    """404: the thing does not exist, or the caller may not know it exists."""

    status = 404
    code = "not_found"
    default_message = "Not found"


class Conflict(AppError):
    """409: the change clashes with the current state (duplicate, wrong status)."""

    status = 409
    code = "conflict"
    default_message = "This clashes with something already saved"


class PayloadTooLarge(AppError):
    """413: an upload over the size limit."""

    status = 413
    code = "payload_too_large"
    default_message = "The upload is too large"


class RateLimited(AppError):
    """429: too many attempts in the window."""

    status = 429
    code = "rate_limited"
    default_message = "Too many requests. Try again later."


class Unavailable(AppError):
    """503: a service we depend on (the database, Stripe…) did not answer."""

    status = 503
    code = "unavailable"
    default_message = "A service we depend on is unavailable. Please try again."


class BadGateway(AppError):
    """502: a service we depend on answered, but not with something we could use."""

    status = 502
    code = "bad_gateway"
    default_message = "A service we depend on returned an unusable answer."


def error_codes() -> list[str]:
    """Every `code` an `AppError` can carry, walked from the class tree."""
    found = {AppError.code}

    def collect_codes(error_class: type[AppError]) -> None:
        """Add the code of every subclass below `error_class`, recursively."""
        for subclass in error_class.__subclasses__():
            found.add(subclass.code)
            collect_codes(subclass)

    collect_codes(AppError)
    return sorted(found)


def error_responses(*errors: type[AppError]) -> dict[int | str, dict[str, Any]]:
    """The `responses=` mapping that documents a route's errors in OpenAPI."""
    responses: dict[int | str, dict[str, Any]] = {}
    for error_class in errors:
        # Several errors can share a status; list all their codes under it.
        entry = responses.setdefault(error_class.status, {"model": ErrorResponse, "description": ""})
        codes: list[str] = entry.setdefault("x-codes", [])
        if error_class.code not in codes:
            codes.append(error_class.code)
        entry["description"] = ", ".join(codes)
    return responses


def register_error_handlers(app: FastAPI) -> None:
    """Render every `AppError` as `{"detail", "code"}` with the error's status.

    FastAPI's own 422 validation response is left unchanged, for parity with the baseline.
    """

    @app.exception_handler(AppError)
    async def render_app_error(_request: Request, exc: AppError) -> JSONResponse:
        """Turn a raised `AppError` into its JSON response.

        A 5xx is a bug or an outage, not a business rule: log it with its stack trace at error
        level, which the Sentry logging integration reports (a 4xx is the caller's doing, so quiet).
        """
        if exc.status >= 500:
            get_logger(__name__).error("server error code=%s", exc.code, exc_info=exc)
        body = ErrorResponse(detail=exc.message, code=exc.code)
        return JSONResponse(status_code=exc.status, content=body.model_dump())

    @app.exception_handler(Exception)
    async def render_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        """Anything else is a bug or an outage: a 500 in the same shape (the server still logs it)."""
        unexpected = AppError()
        body = ErrorResponse(detail=unexpected.message, code=unexpected.code)
        return JSONResponse(status_code=unexpected.status, content=body.model_dump())
