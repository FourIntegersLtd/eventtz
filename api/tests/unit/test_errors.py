"""AppErrors render as `{"detail", "code"}` so baseline clients reading `detail` keep working."""

from __future__ import annotations

import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import AppError, NotFound, register_error_handlers
from app.features.bookings.errors import UnknownReminderColumn
from app.features.bookings.repository_maintenance import stamp_enquiry_reminders
from app.features.notifications.errors import UnsupportedWelcomeUserType
from app.features.notifications.service import render_welcome


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


def test_a_welcome_for_an_unknown_user_type_is_coded() -> None:
    with pytest.raises(UnsupportedWelcomeUserType) as raised:
        render_welcome(email="a@example.com", user_type="staff")
    assert raised.value.code == "unsupported_welcome_user_type"


async def test_stamping_an_unknown_reminder_column_is_coded() -> None:
    with pytest.raises(UnknownReminderColumn) as raised:
        await stamp_enquiry_reminders(None, "booking-id", ["status"])  # type: ignore[arg-type]
    assert (raised.value.status, raised.value.code) == (500, "unknown_reminder_column")


def test_a_server_error_is_logged_with_its_stack_trace() -> None:
    """A coded 5xx keeps the stack trace (and so the Sentry event) the old bare RuntimeError had."""

    class Broken(AppError):
        """A sample 500 with its own code."""

        code = "broken_thing"

    app = FastAPI()
    register_error_handlers(app)

    @app.get("/broken")
    def broken() -> None:
        """Raise the sample 500."""
        raise Broken

    with structlog.testing.capture_logs() as logged:
        response = TestClient(app).get("/broken")
        TestClient(app).get("/missing-route")  # a 404 is not logged as an error
    assert response.json() == {"detail": "Something went wrong", "code": "broken_thing"}
    errors = [entry for entry in logged if entry["log_level"] == "error"]
    assert len(errors) == 1
    assert errors[0]["event"] == "server error code=broken_thing"
    assert isinstance(errors[0]["exc_info"], Broken)
