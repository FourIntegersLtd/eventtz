"""Submit must persist the cleared returned-for-edits timestamp."""

from __future__ import annotations

from unittest.mock import patch

from app.features.vendors.profile import upsert_vendor_profile

_USER = "test-vendor-resubmit-user"

_EXISTING = {
    "id": "vendor-row-1",
    "user_id": _USER,
    "status": "draft",
    "approval_status": "pending",
    "current_step": 8,
    "payload": {
        "businessName": "Scenery Studios",
        "returnedForEditsAt": "2026-08-15T10:00:00+00:00",
    },
}


@patch("app.features.vendors.profile.send_admin_vendor_submitted_email")
@patch("app.features.vendors.profile.upsert_user_profile")
@patch("app.features.vendors.profile.assert_business_name_available")
@patch("app.features.vendors.profile.validate_payload_for_progress")
@patch("app.features.vendors.profile.get_db")
@patch("app.features.vendors.profile.get_vendor_profile")
def test_submit_clears_returned_for_edits_before_persist(
    mock_get_profile,
    mock_get_db,
    _mock_validate,
    _mock_name,
    _mock_upsert_user,
    _mock_email,
):
    submitted = {**_EXISTING, "status": "submitted", "current_step": 9}
    mock_get_profile.side_effect = [_EXISTING, submitted]

    out = upsert_vendor_profile(
        _USER,
        current_step=9,
        payload={"businessName": "Scenery Studios"},
        status="submitted",
        user_email="vendor@example.com",
    )
    assert out["status"] == "submitted"

    update_call = mock_get_db.return_value.table.return_value.update
    update_call.assert_called_once()
    update_args = update_call.call_args[0][0]
    assert isinstance(update_args.get("payload"), dict)
    assert "returnedForEditsAt" not in update_args["payload"]
