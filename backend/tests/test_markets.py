"""Market config helpers."""

from app.core.markets import (
    DEFAULT_COUNTRY_CODE,
    default_market,
    enabled_markets,
    get_market,
    is_market_enabled,
    normalize_country_code,
)


def test_default_market_is_gb():
    market = default_market()
    assert market.country_code == "GB"
    assert market.currency == "GBP"
    assert market.enabled is True


def test_normalize_country_code():
    assert normalize_country_code("gb") == "GB"
    assert normalize_country_code("XX") == DEFAULT_COUNTRY_CODE
    assert normalize_country_code(None) == DEFAULT_COUNTRY_CODE


def test_enabled_markets():
    codes = [m.country_code for m in enabled_markets()]
    assert "GB" in codes


def test_is_market_enabled():
    assert is_market_enabled("GB") is True
    assert is_market_enabled("NG") is False


def test_get_market_fallback():
    assert get_market("invalid").country_code == "GB"
