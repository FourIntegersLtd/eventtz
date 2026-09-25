"""AppErrors render as `{"detail", "code"}` so baseline clients reading `detail` keep working."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import AppError, NotFound, register_error_handlers


class ThingMissing(NotFound):
    """A sample slice error, as a slice would declare it in its errors.py."""

    code = "thing_missing"
    default_message = "Thing not found."


def make_client() -> TestClient:
    """A tiny app with the error handlers and two routes that raise `ThingMissing`."""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    def boom() -> None:
        """Raise with the default message."""
        raise ThingMissing

    @app.get("/custom")
    def custom() -> None:
        """Raise with a custom message."""
        raise ThingMissing("That thing is gone.")

    return TestClient(app)


def test_default_message_and_code() -> None:
    res = make_client().get("/boom")
    assert res.status_code == 404
    assert res.json() == {"detail": "Thing not found.", "code": "thing_missing"}


def test_custom_message() -> None:
    res = make_client().get("/custom")
    assert res.json() == {"detail": "That thing is gone.", "code": "thing_missing"}


def test_base_error_is_500() -> None:
    assert AppError.status == 500
