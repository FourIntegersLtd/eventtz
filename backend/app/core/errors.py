"""Application errors and FastAPI exception mapping."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base for application errors surfaced to clients."""

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class NotFoundError(AppError):
    pass


class ForbiddenError(AppError):
    pass


class ValidationError(AppError):
    pass


class PayloadTooLargeError(AppError):
    pass


class ConflictError(AppError):
    pass


class ServiceUnavailableError(AppError):
    pass


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
        return JSONResponse(status_code=_status_for(exc), content={"detail": exc.message})
