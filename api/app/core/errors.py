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


class ErrorResponse(BaseModel):
    detail: str
    code: str


class AppError(Exception):
    status: int = 500
    code: str = "internal_error"
    default_message: str = "Something went wrong"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class InvalidInput(AppError):
    status = 400
    code = "invalid_input"
    default_message = "The request was not valid"


class Unauthenticated(AppError):
    status = 401
    code = "unauthenticated"
    default_message = "Please sign in to continue."


class Forbidden(AppError):
    status = 403
    code = "forbidden"
    default_message = "You do not have access to this resource"


class NotFound(AppError):
    status = 404
    code = "not_found"
    default_message = "Not found"


class Conflict(AppError):
    status = 409
    code = "conflict"
    default_message = "This clashes with something already saved"


class PayloadTooLarge(AppError):
    status = 413
    code = "payload_too_large"
    default_message = "The upload is too large"


class RateLimited(AppError):
    status = 429
    code = "rate_limited"
    default_message = "Too many requests. Try again later."


class Unavailable(AppError):
    status = 503
    code = "unavailable"
    default_message = "A service we depend on is unavailable. Please try again."


def error_codes() -> list[str]:
    """Every `code` an `AppError` can carry, walked from the class tree."""
    found = {AppError.code}

    def walk(cls: type[AppError]) -> None:
        for sub in cls.__subclasses__():
            found.add(sub.code)
            walk(sub)

    walk(AppError)
    return sorted(found)


def error_responses(*errors: type[AppError]) -> dict[int | str, dict[str, Any]]:
    """The `responses=` mapping that documents a route's errors in OpenAPI."""
    responses: dict[int | str, dict[str, Any]] = {}
    for err in errors:
        entry = responses.setdefault(err.status, {"model": ErrorResponse, "description": ""})
        codes: list[str] = entry.setdefault("x-codes", [])
        if err.code not in codes:
            codes.append(err.code)
        entry["description"] = ", ".join(codes)
    return responses


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_request: Request, exc: AppError) -> JSONResponse:
        body = ErrorResponse(detail=exc.message, code=exc.code)
        return JSONResponse(status_code=exc.status, content=body.model_dump())
