from unittest.mock import MagicMock, patch

from app.core.sentry import init_sentry, traces_sampler


def test_health_transactions_are_not_sampled() -> None:
    assert (
        traces_sampler(
            {
                "asgi_scope": {"path": "/health"},
                "transaction_context": {"name": "http.server"},
            }
        )
        == 0.0
    )


def test_parent_sampled_false_is_respected() -> None:
    assert (
        traces_sampler(
            {
                "asgi_scope": {"path": "/api/v1/client/me"},
                "parent_sampled": False,
            }
        )
        == 0.0
    )


def test_init_sentry_skips_when_dsn_empty() -> None:
    settings = MagicMock()
    settings.sentry_dsn = "  "
    settings.is_production = False
    with (
        patch("app.core.sentry.get_settings", return_value=settings),
        patch("app.core.sentry.sentry_sdk.init") as init,
    ):
        init_sentry()
        init.assert_not_called()


def test_init_sentry_uses_production_environment() -> None:
    settings = MagicMock()
    settings.sentry_dsn = "https://key@o0.ingest.sentry.io/1"
    settings.is_production = True
    with (
        patch("app.core.sentry.get_settings", return_value=settings),
        patch("app.core.sentry.sentry_sdk.init") as init,
    ):
        init_sentry()
        init.assert_called_once()
        kwargs = init.call_args.kwargs
        assert kwargs["dsn"] == settings.sentry_dsn
        assert kwargs["environment"] == "production"
        assert kwargs["send_default_pii"] is False
        assert kwargs["traces_sampler"] is traces_sampler
