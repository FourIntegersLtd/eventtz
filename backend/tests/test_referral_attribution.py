"""Tests for creator referral links."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.referrals import attribution, partners, slug
from app.features.referrals.links import referral_register_url


def test_slugify_display_name() -> None:
    assert slug.slugify_display_name("Scenery Studios") == "scenery-studios"
    assert slug.is_valid_slug("scenery-studios")
    assert not slug.is_valid_slug("Scenery Studios")


def test_referral_register_url_uses_live_domain() -> None:
    assert referral_register_url("scenery-studios") == (
        "https://www.eventtz.com/vendor/register?ref=scenery-studios"
    )


@patch("app.features.referrals.partners.get_db")
def test_resolve_unique_slug_appends_suffix_on_collision(mock_get_client) -> None:
    client = MagicMock()
    mock_get_client.return_value = client
    table = MagicMock()
    client.table.return_value = table
    select = MagicMock()
    table.select.return_value = select
    eq = MagicMock()
    select.eq.return_value = eq
    limit = MagicMock()
    eq.limit.return_value = limit
    limit.execute.side_effect = [
        MagicMock(data=[{"id": "existing"}]),
        MagicMock(data=[]),
    ]
    assert partners.resolve_unique_slug(display_name="Scenery Studios") == "scenery-studios-2"


@patch("app.features.referrals.attribution.get_active_partner_by_slug")
@patch("app.features.referrals.attribution.get_db")
def test_try_attribute_vendor_signup_inserts_row(mock_get_client, mock_partner) -> None:
    mock_partner.return_value = {"id": "partner-1", "slug": "scenery-studios"}
    client = MagicMock()
    mock_get_client.return_value = client
    table = MagicMock()
    client.table.return_value = table
    insert = MagicMock()
    table.insert.return_value = insert
    insert.execute.return_value = MagicMock(data=[{"user_id": "u1"}])

    ok = attribution.try_attribute_vendor_signup(user_id="u1", referral_code="scenery-studios")
    assert ok is True
    table.insert.assert_called_once()
    row = table.insert.call_args[0][0]
    assert row["user_id"] == "u1"
    assert row["referral_partner_id"] == "partner-1"
    assert row["shoutout_completed"] is False


@patch("app.features.referrals.attribution.get_active_partner_by_slug", return_value=None)
def test_try_attribute_vendor_signup_ignores_unknown_code(_mock_partner) -> None:
    assert attribution.try_attribute_vendor_signup(user_id="u1", referral_code="unknown") is False


@patch("app.features.referrals.attribution.get_db")
def test_update_shoutout_completed_sets_timestamp(mock_get_client) -> None:
    client = MagicMock()
    mock_get_client.return_value = client
    table = MagicMock()
    client.table.return_value = table
    update = MagicMock()
    table.update.return_value = update
    eq = MagicMock()
    update.eq.return_value = eq
    eq.execute.return_value = MagicMock(
        data=[{"user_id": "u1", "shoutout_completed": True, "shoutout_completed_at": "2026-01-01T00:00:00Z"}]
    )

    row = attribution.update_shoutout_completed(user_id="u1", shoutout_completed=True)
    assert row is not None
    assert row["shoutout_completed"] is True
    patch_body = table.update.call_args[0][0]
    assert patch_body["shoutout_completed"] is True
    assert patch_body["shoutout_completed_at"] is not None


@patch("app.features.referrals.attribution.get_db")
def test_update_shoutout_completed_clears_timestamp_when_off(mock_get_client) -> None:
    client = MagicMock()
    mock_get_client.return_value = client
    table = MagicMock()
    client.table.return_value = table
    update = MagicMock()
    table.update.return_value = update
    eq = MagicMock()
    update.eq.return_value = eq
    eq.execute.return_value = MagicMock(data=[{"user_id": "u1", "shoutout_completed": False}])

    attribution.update_shoutout_completed(user_id="u1", shoutout_completed=False)
    patch_body = table.update.call_args[0][0]
    assert patch_body["shoutout_completed"] is False
    assert patch_body["shoutout_completed_at"] is None
