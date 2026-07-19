"""Shared error types and how they become API responses."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base error we can safely show to the caller as a message."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class NotFoundError(AppError):
    """Something the user asked for isn't there."""


class ForbiddenError(AppError):
    """Signed in, but not allowed to do this."""


class ValidationError(AppError):
    """The request data doesn't look right."""


class PayloadTooLargeError(AppError):
    """The upload or body is bigger than we allow."""


class ConflictError(AppError):
    """This clashes with something already saved (e.g. already exists)."""


class ServiceUnavailableError(AppError):
    """A needed service isn't ready right now."""


def _status_for(exc: AppError) -> int:
    if isinstance(exc, NotFoundError):
        return 404
    if isinstance(exc, ForbiddenError):
        return 403
    if isinstance(exc, ValidationError):
        return 400
    if isinstance(exc, PayloadTooLargeError):
        return 413
    if isinstance(exc, ConflictError):
        return 409
    if isinstance(exc, ServiceUnavailableError):
        return 503
    return 500


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        content: dict[str, str] = {"detail": exc.message}
        if exc.code:
            content["code"] = exc.code
        return JSONResponse(status_code=_status_for(exc), content=content)
