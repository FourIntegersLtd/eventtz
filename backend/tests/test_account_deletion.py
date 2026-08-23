"""Account deletion: tombstone + erase PII; never wipe counterparties or bookings."""

from __future__ import annotations

from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import ConflictError, ForbiddenError, ValidationError
from app.features.auth.accounts import upsert_user_profile
from app.features.auth.user_vendor_display_lookup import (
    DELETED_USER_DISPLAY,
    DELETED_VENDOR_DISPLAY,
    client_display_names_by_id,
    vendor_display_names_by_id,
)
from app.features.settings import account_deletion as deletion
from app.features.vendors.visibility import row_is_publicly_listable


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, store: dict, table: str):
        self._store = store
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._eq: dict = {}
        self._in_filters: dict[str, list] = {}

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def in_(self, col, values):
        self._in_filters[col] = list(values)
        return self

    def limit(self, *_a):
        return self

    def order(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def _rows_match(self, row: dict) -> bool:
        if self._eq and not all(row.get(k) == v for k, v in self._eq.items()):
            return False
        for col, values in self._in_filters.items():
            if row.get(col) not in values:
                return False
        return True

    def execute(self):
        if self._op == "delete":
            self._store["deletes"].append((self._table, dict(self._eq)))
        elif self._op == "update" and self._payload is not None:
            matched = [
                r
                for r in self._store["rows"].get(self._table, [])
                if self._rows_match(r)
            ]
            if matched:
                self._store["updates"].append(
                    (self._table, dict(self._payload), dict(self._eq)),
                )
                for row in matched:
                    row.update(self._payload)
        rows = list(self._store["rows"].get(self._table, []))
        if self._eq or self._in_filters:
            rows = [r for r in rows if self._rows_match(r)]
        return _Result(rows)


class _Db:
    def __init__(self, store: dict):
        self._store = store
        self.auth = MagicMock()

    def table(self, name: str):
        return _Query(self._store, name)


def _store_with_booking(*, client="client-a", vendor="vendor-b", extra=None):
    booking = {
        "id": "booking-ab",
        "status": "completed",
        "payment_status": "payout_released",
        "event_date": "2024-01-01",
        "event_end_date": None,
        "client_user_id": client,
        "vendor_user_id": vendor,
        "notes": "secret",
        "client_search_context": {"q": "wedding"},
        "event_name": "Wedding",
        "event_address": "1 High St",
    }
    if extra:
        booking.update(extra)
    return {
        "rows": {
            "booking_requests": [dict(booking)],
            "dispute_cases": [],
            "vendors": [],
            "messages": [],
            "booking_reviews": [],
            "users": [
                {"id": client, "user_type": "client", "email": "client@example.com"},
                {"id": vendor, "user_type": "vendor", "email": "vendor@example.com"},
            ],
        },
        "updates": [],
        "deletes": [],
    }


def _patch_common(store, profile, password_ok=True):
    db = _Db(store)
    auth_ok = {"success": True, "user": {"id": profile["id"]}}
    auth_fail = {"success": False, "error": "no"}
    db_targets = (
        "app.features.settings.account_deletion",
        "app.features.settings.account_deletion_gates",
        "app.features.settings.account_deletion_erase",
        "app.features.settings.account_deletion_storage",
    )
    patches = [
        patch("app.features.settings.account_deletion.fetch_user_profile", return_value=profile),
        *[patch(f"{target}.get_db", return_value=db) for target in db_targets],
        patch("app.features.settings.account_deletion_storage.get_supabase", return_value=MagicMock()),
        patch(
            "app.core.config.get_settings",
            return_value=MagicMock(media_images_bucket="eventtz-images", mixpanel_token=""),
        ),
        patch("app.features.settings.account_deletion.send_account_deleted_email", return_value=True),
        patch("app.features.settings.account_deletion_erase.dispatch_booking_notification"),
        patch(
            "app.features.settings.account_deletion_gates.SupabaseAuthService",
            return_value=MagicMock(
                sign_in_with_password=MagicMock(
                    return_value=auth_ok if password_ok else auth_fail,
                ),
            ),
        ),
    ]
    return (*patches, db)


def test_admin_cannot_self_delete() -> None:
    store = _store_with_booking()
    patches = _patch_common(store, {"id": "admin-1", "user_type": "admin", "email": "a@x.com"})
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        db = patches[-1]
        with pytest.raises(ForbiddenError):
            deletion.delete_own_account(user_id="admin-1", password="secret1")
    assert db.auth.admin.delete_user.call_count == 0
    assert not any(t == "users" for t, _eq in store["deletes"])


def test_wrong_password_refuses() -> None:
    store = _store_with_booking()
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile, password_ok=False)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        with pytest.raises(ValidationError):
            deletion.delete_own_account(user_id="client-a", password="nope")


def test_blocks_paid_in_flight() -> None:
    store = _store_with_booking(extra={"status": "accepted", "payment_status": "paid"})
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        with pytest.raises(ConflictError) as exc:
            deletion.delete_own_account(user_id="client-a", password="secret1")
    assert exc.value.code == "money_in_flight"


def test_blocks_accepted_event_ahead() -> None:
    store = _store_with_booking(
        extra={"status": "accepted", "payment_status": "unpaid", "event_date": "2099-01-01"},
    )
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        with pytest.raises(ConflictError) as exc:
            deletion.delete_own_account(user_id="client-a", password="secret1")
    assert exc.value.code == "active_booking"


def test_blocks_open_dispute() -> None:
    store = _store_with_booking()
    store["rows"]["dispute_cases"] = [
        {"id": "d1", "opened_by_user_id": "client-a", "status": "open", "booking_request_id": "booking-ab"},
    ]
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        with pytest.raises(ConflictError) as exc:
            deletion.delete_own_account(user_id="client-a", password="secret1")
    assert exc.value.code == "open_dispute"


def test_client_delete_keeps_booking_and_counterparty() -> None:
    store = _store_with_booking()
    store["rows"]["booking_requests"].append(
        {
            "id": "booking-bc",
            "status": "completed",
            "payment_status": "payout_released",
            "event_date": "2024-02-01",
            "event_end_date": None,
            "client_user_id": "client-c",
            "vendor_user_id": "vendor-b",
            "notes": "other party notes",
        },
    )
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        db = patches[-1]
        deletion.delete_own_account(user_id="client-a", password="secret1")

    deleted_tables = [t for t, _eq in store["deletes"]]
    assert "users" not in deleted_tables
    assert "booking_requests" not in deleted_tables
    assert "conversations" not in deleted_tables
    assert "vendors" not in deleted_tables
    assert all(
        eq.get("user_id") == "client-a"
        or eq.get("client_user_id") == "client-a"
        or eq.get("vendor_user_id") == "client-a"
        or eq.get("sender_user_id") == "client-a"
        or eq.get("recipient_user_id") == "client-a"
        or eq.get("actor_user_id") == "client-a"
        for t, eq in store["deletes"]
    )

    user_updates = [p for t, p, _eq in store["updates"] if t == "users"]
    assert user_updates
    assert user_updates[0].get("email") is None
    assert user_updates[0].get("deleted_at")

    booking_updates = [
        (p, eq)
        for t, p, eq in store["updates"]
        if t == "booking_requests" and ("notes" in p or "client_search_context" in p)
    ]
    assert booking_updates
    assert all(eq.get("client_user_id") == "client-a" for _p, eq in booking_updates)
    assert all(
        "event_address" not in p and "event_name" not in p for p, _eq in booking_updates
    )

    booking = store["rows"]["booking_requests"][0]
    assert booking["event_address"] == "1 High St"
    assert booking["notes"] is None

    db.auth.admin.delete_user.assert_called_once_with("client-a")
    assert store["rows"]["booking_requests"][0]["id"] == "booking-ab"
    assert store["rows"]["booking_requests"][1]["id"] == "booking-bc"


def test_vendor_delete_keeps_counterparties_and_other_bookings() -> None:
    store = _store_with_booking(vendor="vendor-b")
    store["rows"]["booking_requests"].append(
        {
            "id": "booking-bc",
            "status": "completed",
            "payment_status": "payout_released",
            "event_date": "2024-02-01",
            "event_end_date": None,
            "client_user_id": "client-c",
            "vendor_user_id": "vendor-b",
            "notes": "client notes on other booking",
        },
    )
    store["rows"]["vendors"] = [{"user_id": "vendor-b", "payload": {"businessName": "Amina"}}]
    profile = {"id": "vendor-b", "user_type": "vendor", "email": "v@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        db = patches[-1]
        deletion.delete_own_account(user_id="vendor-b", password="secret1")

    deleted_tables = [t for t, _eq in store["deletes"]]
    assert "users" not in deleted_tables
    assert "booking_requests" not in deleted_tables
    assert "conversations" not in deleted_tables
    assert "vendors" not in deleted_tables
    assert not any(
        t == "booking_requests" and ("notes" in p or "client_search_context" in p)
        for t, p, _eq in store["updates"]
    )
    assert store["rows"]["booking_requests"][0]["notes"] == "secret"
    db.auth.admin.delete_user.assert_called_once_with("vendor-b")
    assert {r["id"] for r in store["rows"]["booking_requests"]} == {"booking-ab", "booking-bc"}


def test_cancels_unpaid_pending_via_update() -> None:
    store = _store_with_booking(extra={"status": "pending", "payment_status": "unpaid"})
    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        deletion.delete_own_account(user_id="client-a", password="secret1")
    status_updates = [
        p for t, p, _eq in store["updates"] if t == "booking_requests" and p.get("status") == "cancelled"
    ]
    assert status_updates
    assert "booking_requests" not in [t for t, _eq in store["deletes"]]


def test_vendor_delete_hides_listing_does_not_delete_vendor_row() -> None:
    store = _store_with_booking(vendor="vendor-b")
    store["rows"]["vendors"] = [
        {"user_id": "vendor-b", "payload": {"businessName": "Amina"}, "stripe_account_id": "acct_1"},
    ]
    profile = {"id": "vendor-b", "user_type": "vendor", "email": "v@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        mock_stripe = stack.enter_context(
            patch("app.features.payments.stripe.delete_connect_account"),
        )
        deletion.delete_own_account(user_id="vendor-b", password="secret1")
    mock_stripe.assert_called_once_with("acct_1")
    assert "vendors" not in [t for t, _eq in store["deletes"]]
    vendor_updates = [p for t, p, _eq in store["updates"] if t == "vendors"]
    assert vendor_updates
    assert vendor_updates[0].get("listing_override") == "hidden"
    assert vendor_updates[0].get("payload") == {}
    assert vendor_updates[0].get("approval_status") is None


def test_idempotent_retry_only_auth_delete() -> None:
    store = _store_with_booking()
    profile = {
        "id": "client-a",
        "user_type": "client",
        "email": None,
        "deleted_at": "2026-08-23T00:00:00+00:00",
    }
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        db = patches[-1]
        deletion.delete_own_account(user_id="client-a", password="secret1")
    assert not store["updates"]
    assert not store["deletes"]
    db.auth.admin.delete_user.assert_called_once_with("client-a")


def test_upsert_user_profile_refuses_tombstone() -> None:
    tombstone = {"id": "u1", "deleted_at": "2026-08-23T00:00:00+00:00", "user_type": "client"}
    mock_db = MagicMock()
    with (
        patch("app.features.auth.accounts.fetch_user_profile", return_value=tombstone),
        patch("app.features.auth.accounts.get_db", return_value=mock_db),
    ):
        upsert_user_profile("u1", "back@x.com", "client")
    mock_db.table.assert_not_called()


def test_display_names_for_deleted_users() -> None:
    with (
        patch(
            "app.features.auth.user_vendor_display_lookup.user_repository.list_by_ids",
            return_value=[{"id": "c1", "email": None, "preferred_name": None}],
        ),
        patch(
            "app.features.auth.user_vendor_display_lookup.deleted_user_ids",
            return_value={"c1"},
        ),
    ):
        names = client_display_names_by_id(["c1"])
    assert names["c1"] == DELETED_USER_DISPLAY

    with (
        patch(
            "app.features.auth.user_vendor_display_lookup.vendor_repository.list_by_user_ids",
            return_value=[{"user_id": "v1", "payload": {}}],
        ),
        patch(
            "app.features.auth.user_vendor_display_lookup.deleted_user_ids",
            return_value={"v1"},
        ),
    ):
        vnames = vendor_display_names_by_id(["v1"])
    assert vnames["v1"] == DELETED_VENDOR_DISPLAY


def test_deleted_vendor_hidden_via_listing_override() -> None:
    assert row_is_publicly_listable(
        {
            "approval_status": "approved",
            "listing_override": "hidden",
            "stripe_account_id": "acct",
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": True,
        },
    ) is False


def test_forbidden_tables_never_deleted(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression: marketplace path must not call users/booking_requests/conversations DELETE."""
    store = _store_with_booking()

    def _forbid_delete(self: _Query):
        if self._table in ("users", "booking_requests", "conversations", "vendors"):
            raise AssertionError(f"forbidden DELETE on {self._table}")
        self._op = "delete"
        return self

    monkeypatch.setattr(_Query, "delete", _forbid_delete)

    profile = {"id": "client-a", "user_type": "client", "email": "a@x.com"}
    patches = _patch_common(store, profile)
    with ExitStack() as stack:
        for p in patches[:-1]:
            stack.enter_context(p)
        deletion.delete_own_account(user_id="client-a", password="secret1")
