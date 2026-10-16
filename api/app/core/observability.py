"""Error reporting (copied from OSCE `platform-api`).

Off unless `SENTRY_DSN` is set, which keeps local and test runs silent and
means a deployment opts in by configuration rather than by code.
"""

from __future__ import annotations

import sentry_sdk

from app.core.settings import Settings

# Sampled rather than everything: traces are priced per span, and uptime probes
# and polling screens would otherwise bill for their own heartbeat.
TRACES_SAMPLE_RATE = 0.05


def configure_sentry(settings: Settings) -> bool:
    """Start reporting, if there is somewhere to report to. Returns whether it did."""
    if not settings.sentry_dsn.strip():
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn.strip(),
        environment=settings.app_env.value,
        traces_sample_rate=TRACES_SAMPLE_RATE,
        # A request body can hold a password or a reset token. None of that
        # belongs in an error report, and the default is to send it.
        send_default_pii=False,
        max_request_body_size="never",
    )
    return True


def bind_sentry_user(*, user_id: str, user_type: str | None = None) -> None:
    """Tag this request's error reports with the signed-in user's id (never their email), like the baseline.

    A no-op while Sentry is not initialised, so tests and local runs stay silent.
    """
    if not user_id or not sentry_sdk.is_initialized():
        return
    sentry_sdk.set_user({"id": user_id})
    if user_type:
        sentry_sdk.set_tag("user_type", user_type)
