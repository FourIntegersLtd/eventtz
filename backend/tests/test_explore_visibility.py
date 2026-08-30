"""Explore list/detail hide vendors that are not publicly listable."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.features.vendors.moderation import (
    get_approved_vendor_for_explore_by_id,
    list_approved_vendors_for_explore,
)
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


def _explore_query_mock(*, data: list[dict[str, object]]) -> MagicMock:
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.neq.return_value = q
    q.or_.return_value = q
    q.limit.return_value = q
    q.execute.return_value = MagicMock(data=data)
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


def _chained_query() -> MagicMock:
    q = MagicMock()
    for name in ("select", "eq", "neq", "or_", "order", "in_", "gte", "lte", "overlaps", "ilike"):
        getattr(q, name).return_value = q
    return q


@patch("app.features.vendors.moderation.deleted_user_ids", return_value=set())
@patch("app.features.vendors.moderation.get_db")
def test_explore_list_returns_vendors_when_emails_time_out(
    mock_get_db: MagicMock,
    _gone: MagicMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    vendors_q = _chained_query()
    vendors_q.execute.return_value = MagicMock(
        data=[
            {
                "user_id": "v1",
                "status": "complete",
                "approval_status": "approved",
                "payload": {},
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
        ],
    )
    users_q = _chained_query()
    users_q.execute.side_effect = httpx.ReadTimeout("The read operation timed out")

    def table(name: str) -> MagicMock:
        if name == "vendors":
            return vendors_q
        if name == "users":
            return users_q
        raise AssertionError(name)

    mock_get_db.return_value.table.side_effect = table

    with caplog.at_level("WARNING"):
        rows = list_approved_vendors_for_explore(country_code="GB")

    assert len(rows) == 1
    assert rows[0]["user_id"] == "v1"
    assert rows[0]["email"] is None
    assert "explore: vendor emails unavailable" in caplog.text


@patch("app.features.vendors.moderation.deleted_user_ids", return_value=set())
@patch("app.features.vendors.moderation.get_db")
def test_explore_list_still_raises_unexpected_email_errors(
    mock_get_db: MagicMock,
    _gone: MagicMock,
) -> None:
    vendors_q = _chained_query()
    vendors_q.execute.return_value = MagicMock(
        data=[
            {
                "user_id": "v1",
                "status": "complete",
                "approval_status": "approved",
                "payload": {},
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
        ],
    )
    users_q = _chained_query()
    users_q.execute.side_effect = RuntimeError("boom")
    mock_get_db.return_value.table.side_effect = lambda name: vendors_q if name == "vendors" else users_q

    with pytest.raises(RuntimeError, match="boom"):
        list_approved_vendors_for_explore(country_code="GB")
