from unittest.mock import MagicMock, patch

from app.core.sentry import bind_sentry_user, init_sentry, sentry_before_send, traces_sampler


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


def test_traces_sampler_uses_production_rate() -> None:
    settings = MagicMock()
    settings.is_production = True
    with patch("app.core.sentry.get_settings", return_value=settings):
        assert traces_sampler({"asgi_scope": {"path": "/api/v1/client/me"}}) == 0.1


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
        assert kwargs["before_send"] is sentry_before_send


def test_sentry_before_send_drops_only_smoke_tests() -> None:
    assert sentry_before_send({"message": "NEW issue test - safe to ignore"}, None) is None
    real = {
        "exception": {
            "values": [{"type": "TypeError", "value": "Cannot read property x of undefined"}],
        },
    }
    assert sentry_before_send(real, None) is real


def test_bind_sentry_user_sets_id_and_type_only() -> None:
    settings = MagicMock()
    settings.sentry_dsn = "https://key@o0.ingest.sentry.io/1"
    with (
        patch("app.core.sentry.get_settings", return_value=settings),
        patch("app.core.sentry.sentry_sdk.set_user") as set_user,
        patch("app.core.sentry.sentry_sdk.set_tag") as set_tag,
    ):
        bind_sentry_user(user_id="user-1", user_type="client")
        set_user.assert_called_once_with({"id": "user-1"})
        set_tag.assert_called_once_with("user_type", "client")


def test_bind_sentry_user_skips_when_dsn_empty() -> None:
    settings = MagicMock()
    settings.sentry_dsn = ""
    with (
        patch("app.core.sentry.get_settings", return_value=settings),
        patch("app.core.sentry.sentry_sdk.set_user") as set_user,
    ):
        bind_sentry_user(user_id="user-1", user_type="client")
        set_user.assert_not_called()
