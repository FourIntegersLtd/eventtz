"""Explore list/detail hide vendors that are not publicly listable."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.features.vendors.moderation import (
    get_approved_vendor_for_explore_by_id,
    list_approved_vendors_for_explore,
)
from app.features.vendors.public_metrics import get_public_metrics_for_vendors
from app.features.vendors.visibility import row_is_publicly_listable

_STRIPE_READY = {
    "stripe_account_id": "acct_1",
    "stripe_charges_enabled": True,
    "stripe_payouts_enabled": True,
}


def test_approved_stripe_ready_vendor_is_listable() -> None:
    assert (
        row_is_publicly_listable(
            {
                "approval_status": "approved",
                "listing_override": "auto",
                **_STRIPE_READY,
            },
        )
        is True
    )


def test_hidden_override_is_not_listable_even_when_approved() -> None:
    assert (
        row_is_publicly_listable(
            {
                "approval_status": "approved",
                "listing_override": "hidden",
                **_STRIPE_READY,
            },
        )
        is False
    )


def test_unapproved_vendor_is_not_listable() -> None:
    assert (
        row_is_publicly_listable(
            {
                "approval_status": "pending",
                "listing_override": "auto",
                **_STRIPE_READY,
            },
        )
        is False
    )


def test_visible_override_lists_without_stripe() -> None:
    row = {
        "approval_status": "approved",
        "listing_override": "auto",
        "stripe_account_id": None,
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
    }
    assert row_is_publicly_listable(row) is False
    assert row_is_publicly_listable({**row, "listing_override": "visible"}) is True


def _explore_query_mock(
    *,
    data: list[dict[str, object]] | None = None,
    execute_error: BaseException | None = None,
) -> MagicMock:
    q = MagicMock()
    for name in (
        "select",
        "eq",
        "neq",
        "or_",
        "in_",
        "gte",
        "lte",
        "overlaps",
        "ilike",
        "order",
        "limit",
    ):
        getattr(q, name).return_value = q
    if execute_error is not None:
        q.execute.side_effect = execute_error
    else:
        q.execute.return_value = MagicMock(data=data or [])
    return q


@patch("app.features.vendors.moderation.get_db")
def test_explore_detail_returns_none_when_listing_filters_exclude_vendor(
    mock_get_db: MagicMock,
) -> None:
    mock_get_db.return_value.table.return_value = _explore_query_mock(data=[])
    assert get_approved_vendor_for_explore_by_id("hidden-vendor") is None


@patch("app.features.vendors.moderation.is_deleted_user_id", return_value=True)
@patch("app.features.vendors.moderation.get_db")
def test_explore_detail_returns_none_for_deleted_account(
    mock_get_db: MagicMock,
    _deleted: MagicMock,
) -> None:
    mock_get_db.return_value.table.return_value = _explore_query_mock(
        data=[
            {
                "user_id": "v1",
                "status": "complete",
                "approval_status": "approved",
                "payload": {},
                "updated_at": None,
            },
        ],
    )
    assert get_approved_vendor_for_explore_by_id("v1") is None


_LIST_VENDOR = {
    "user_id": "v1",
    "status": "complete",
    "approval_status": "approved",
    "payload": {"businessName": "Acme Catering"},
    "updated_at": "2026-08-01T00:00:00+00:00",
}


@patch("app.features.vendors.moderation.get_db")
def test_explore_list_returns_vendors_when_users_lookup_times_out(
    mock_get_db: MagicMock,
) -> None:
    vendors = _explore_query_mock(data=[_LIST_VENDOR])
    users = _explore_query_mock(execute_error=httpx.ReadTimeout("timed out"))
    mock_get_db.return_value.table.side_effect = lambda name: vendors if name == "vendors" else users

    rows = list_approved_vendors_for_explore(country_code="GB")
    assert len(rows) == 1
    assert rows[0]["user_id"] == "v1"
    assert rows[0]["email"] is None
    assert rows[0]["payload"]["businessName"] == "Acme Catering"


@patch("app.features.vendors.moderation.get_db")
def test_explore_list_skips_deleted_accounts_from_users_lookup(
    mock_get_db: MagicMock,
) -> None:
    vendors = _explore_query_mock(
        data=[
            _LIST_VENDOR,
            {**_LIST_VENDOR, "user_id": "v-gone", "payload": {"businessName": "Gone"}},
        ],
    )
    users = _explore_query_mock(
        data=[
            {"id": "v1", "email": "vendor@example.com", "deleted_at": None},
            {"id": "v-gone", "email": None, "deleted_at": "2026-08-01T00:00:00+00:00"},
        ],
    )
    mock_get_db.return_value.table.side_effect = lambda name: vendors if name == "vendors" else users

    rows = list_approved_vendors_for_explore(country_code="GB")
    assert [r["user_id"] for r in rows] == ["v1"]
    assert rows[0]["email"] == "vendor@example.com"


@patch("app.features.vendors.moderation.get_db")
def test_explore_list_reraises_timeout_on_vendors_query(mock_get_db: MagicMock) -> None:
    mock_get_db.return_value.table.return_value = _explore_query_mock(
        execute_error=httpx.ReadTimeout("timed out"),
    )
    with pytest.raises(httpx.ReadTimeout):
        list_approved_vendors_for_explore(country_code="GB")


@patch("app.features.vendors.public_metrics.get_db")
def test_public_metrics_empty_on_read_timeout(
    mock_get_db: MagicMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mock_get_db.return_value.table.return_value = _explore_query_mock(
        execute_error=httpx.ReadTimeout("timed out"),
    )
    with caplog.at_level("WARNING"):
        stats = get_public_metrics_for_vendors(["v1"])
    assert stats["v1"]["completed_bookings"] == 0
    assert stats["v1"]["avg_response_seconds"] is None
    assert any("public_vendor_metrics: load failed" in rec.message for rec in caplog.records)
    assert not any(rec.levelname == "ERROR" for rec in caplog.records)
