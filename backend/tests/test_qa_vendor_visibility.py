"""Tests for QA-scoped marketplace visibility."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.vendors.qa_visibility import (
    ExploreViewer,
    explore_viewer_from_auth,
    fetch_qa_vendors_for_viewer,
    filter_explore_rows,
    is_qa_scoped_vendor,
    viewer_may_see_qa_vendor,
)
from app.features.vendors.moderation import (
    get_approved_vendor_for_explore_by_id,
    list_approved_vendors_for_explore,
    vendor_is_bookable_for_explore,
)

QA_CLIENT = "y.hkehinde@yahoo.com"
QA_VENDOR = "f8207160-65ee-4d68-8f84-69175803da97"
OTHER_CLIENT = "other.client@example.com"


@pytest.fixture(autouse=True)
def qa_visibility_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "QA_CLIENT_VENDOR_VISIBILITY",
        f"{QA_CLIENT}:{QA_VENDOR}",
    )
    from app.core.config import get_settings

    get_settings.cache_clear()


def _client_viewer(email: str = QA_CLIENT) -> ExploreViewer:
    return ExploreViewer(user_id="client-1", email=email, user_type="client")


def _vendor_viewer() -> ExploreViewer:
    return ExploreViewer(user_id="vendor-1", email="nisha.nigeria@gmail.com", user_type="vendor")


def test_is_qa_scoped_vendor() -> None:
    assert is_qa_scoped_vendor(QA_VENDOR) is True
    assert is_qa_scoped_vendor("other-vendor-id") is False


def test_viewer_may_see_qa_vendor_only_for_allowed_client() -> None:
    assert viewer_may_see_qa_vendor(None, QA_VENDOR) is False
    assert viewer_may_see_qa_vendor(_vendor_viewer(), QA_VENDOR) is False
    assert viewer_may_see_qa_vendor(_client_viewer(OTHER_CLIENT), QA_VENDOR) is False
    assert viewer_may_see_qa_vendor(_client_viewer(QA_CLIENT), QA_VENDOR) is True


def test_filter_explore_rows_strips_qa_vendor_for_wrong_viewer() -> None:
    rows = [
        {"user_id": "public-vendor", "email": "a@example.com"},
        {"user_id": QA_VENDOR, "email": "yahayakehinde911@gmail.com"},
    ]
    filtered = filter_explore_rows(rows, None)
    assert [r["user_id"] for r in filtered] == ["public-vendor"]

    filtered_client = filter_explore_rows(rows, _client_viewer(QA_CLIENT))
    assert [r["user_id"] for r in filtered_client] == ["public-vendor", QA_VENDOR]


def test_explore_viewer_from_auth() -> None:
    assert explore_viewer_from_auth(None) is None
    assert explore_viewer_from_auth({"id": "u1", "email": QA_CLIENT, "user_type": "client"}) == ExploreViewer(
        user_id="u1",
        email=QA_CLIENT,
        user_type="client",
    )


@patch("app.features.vendors.qa_visibility.apply_recent_first_order")
@patch("app.features.vendors.qa_visibility.get_db")
@patch("app.features.vendors.qa_visibility.deleted_user_ids", return_value=set())
def test_fetch_qa_vendors_for_allowed_client(
    _gone: MagicMock,
    mock_get_db: MagicMock,
    mock_order: MagicMock,
) -> None:
    vendors_q = MagicMock()
    mock_order.return_value = vendors_q
    vendors_q.select.return_value = vendors_q
    vendors_q.eq.return_value = vendors_q
    vendors_q.in_.return_value = vendors_q
    vendors_q.execute.return_value = MagicMock(
        data=[
            {
                "user_id": QA_VENDOR,
                "status": "complete",
                "approval_status": "approved",
                "payload": {"businessName": "YHK Ltd"},
                "updated_at": "2026-01-01T00:00:00+00:00",
                "country_code": "GB",
            },
        ],
    )
    users_q = MagicMock()
    users_q.select.return_value = users_q
    users_q.in_.return_value = users_q
    users_q.execute.return_value = MagicMock(
        data=[{"id": QA_VENDOR, "email": "yahayakehinde911@gmail.com"}],
    )
    mock_get_db.return_value.table.side_effect = lambda name: vendors_q if name == "vendors" else users_q

    rows = fetch_qa_vendors_for_viewer(_client_viewer(QA_CLIENT), country_code="GB")
    assert len(rows) == 1
    assert rows[0]["user_id"] == QA_VENDOR


@patch("app.features.vendors.moderation.fetch_qa_vendor_for_explore_by_id")
def test_get_approved_vendor_for_explore_by_id_qa_denied(mock_fetch: MagicMock) -> None:
    mock_fetch.return_value = {"user_id": QA_VENDOR}
    assert get_approved_vendor_for_explore_by_id(QA_VENDOR, viewer=_client_viewer(QA_CLIENT)) == mock_fetch.return_value
    mock_fetch.assert_called_once()
    assert get_approved_vendor_for_explore_by_id(QA_VENDOR, viewer=None) is None


@patch("app.features.vendors.moderation.apply_public_listing_filters")
@patch("app.features.vendors.moderation.apply_recent_first_order")
@patch("app.features.vendors.moderation.get_db")
@patch("app.features.vendors.moderation.deleted_user_ids", return_value=set())
@patch("app.features.vendors.moderation.fetch_qa_vendors_for_viewer", return_value=[])
def test_list_approved_vendors_filters_qa_vendor_with_listing_override_visible(
    _fetch_qa: MagicMock,
    _gone: MagicMock,
    mock_get_db: MagicMock,
    mock_order: MagicMock,
    mock_public_filters: MagicMock,
) -> None:
    """Defense in depth: QA vendor must not leak via global listing_override=visible."""
    vendors_q = MagicMock()
    mock_public_filters.return_value = vendors_q
    mock_order.return_value = vendors_q
    for name in ("select", "eq", "neq", "or_", "limit", "in_", "gte", "lte", "overlaps", "ilike"):
        getattr(vendors_q, name).return_value = vendors_q
    vendors_q.execute.return_value = MagicMock(
        data=[
            {
                "user_id": QA_VENDOR,
                "status": "complete",
                "approval_status": "approved",
                "payload": {},
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
        ],
    )
    users_q = MagicMock()
    users_q.select.return_value = users_q
    users_q.in_.return_value = users_q
    users_q.execute.return_value = MagicMock(
        data=[{"id": QA_VENDOR, "email": "yahayakehinde911@gmail.com"}],
    )
    mock_get_db.return_value.table.side_effect = lambda name: vendors_q if name == "vendors" else users_q

    rows = list_approved_vendors_for_explore(country_code="GB", viewer=None)
    assert rows == []


@patch("app.features.vendors.moderation.fetch_qa_vendor_payload")
def test_vendor_is_bookable_for_explore_qa_client(mock_payload: MagicMock) -> None:
    mock_payload.return_value = {"businessName": "YHK Ltd"}
    assert vendor_is_bookable_for_explore(QA_VENDOR, viewer=_client_viewer(QA_CLIENT)) is True
    assert vendor_is_bookable_for_explore(QA_VENDOR, viewer=_vendor_viewer()) is False
    assert vendor_is_bookable_for_explore(QA_VENDOR, viewer=None) is False
