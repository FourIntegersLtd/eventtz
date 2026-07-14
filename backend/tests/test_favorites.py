"""Client favorites service tests."""

from unittest.mock import MagicMock, patch

from app.features.favorites.service import (
    add_saved_vendor,
    list_saved_vendor_ids,
    merge_saved_vendors,
    remove_saved_vendor,
)


@patch("app.features.favorites.service.apply_recent_first_order", side_effect=lambda q, **_: q)
@patch("app.features.favorites.service.get_settings")
@patch("app.features.favorites.service.get_client")
def test_list_saved_vendor_ids(mock_get_client, mock_settings, _order):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"vendor_user_id": "v1"}, {"vendor_user_id": "v2"}],
    )
    assert list_saved_vendor_ids("client-1") == ["v1", "v2"]


@patch("app.features.favorites.service.get_settings")
@patch("app.features.favorites.service.get_client")
def test_add_saved_vendor(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    assert add_saved_vendor(client_user_id="c1", vendor_user_id="v1") is True
    client.table.return_value.upsert.assert_called_once()


@patch("app.features.favorites.service.get_settings")
@patch("app.features.favorites.service.get_client")
def test_remove_saved_vendor(mock_get_client, mock_settings):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    assert remove_saved_vendor(client_user_id="c1", vendor_user_id="v1") is True


@patch("app.features.favorites.service.add_saved_vendor", return_value=True)
@patch("app.features.favorites.service.get_settings")
def test_merge_saved_vendors(mock_settings, mock_add):
    mock_settings.return_value.local_auth_mode = False
    n = merge_saved_vendors(client_user_id="c1", vendor_user_ids=["v1", "v2", ""])
    assert n == 2
    assert mock_add.call_count == 2
