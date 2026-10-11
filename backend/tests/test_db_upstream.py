"""PostgREST/Supabase unavailability detection."""

from __future__ import annotations

import httpx
from postgrest.exceptions import APIError

from app.core.db import is_upstream_unavailable


def _api_error(
    *,
    message: str,
    code: str | int | None,
    details: str | None = None,
    hint: str | None = None,
) -> APIError:
    return APIError(
        {
            "message": message,
            "code": code,
            "hint": hint,
            "details": details,
        }
    )


def test_httpx_timeout_and_network_are_unavailable() -> None:
    assert is_upstream_unavailable(httpx.ReadTimeout("The read operation timed out"))
    assert is_upstream_unavailable(httpx.ConnectError("connection refused"))


def test_postgrest_gateway_timeout_is_unavailable() -> None:
    assert is_upstream_unavailable(
        _api_error(
            message="JSON could not be generated",
            code=504,
            hint="Refer to full message for details",
            details="{'message': 'Gateway Timeout'}",
        )
    )
    assert is_upstream_unavailable(
        _api_error(message="Gateway Timeout", code=None)
    )
    assert is_upstream_unavailable(_api_error(message="permission denied", code=503))


def test_application_api_errors_are_not_unavailable() -> None:
    assert not is_upstream_unavailable(
        _api_error(
            message="permission denied for table booking_requests",
            code="42501",
        )
    )
    assert not is_upstream_unavailable(
        _api_error(
            message="Could not find the table 'public.job_runs' in the schema cache",
            code="PGRST205",
        )
    )
    assert not is_upstream_unavailable(RuntimeError("boom"))
