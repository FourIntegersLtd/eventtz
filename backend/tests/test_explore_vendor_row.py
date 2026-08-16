"""Vendor row payload alias regression tests."""

from app.contracts.vendor import (
    AdminVendorRow,
    ExploreVendorRow,
    VendorProfileState,
    admin_vendor_row_from_db,
    explore_vendor_row_from_db,
)


def test_explore_vendor_row_from_db_maps_payload_key():
    row = {
        "user_id": "abc-123",
        "approval_status": "approved",
        "status": "complete",
        "payload": {"businessName": "Wishes Group Ltd", "servicesOffered": ["photography"]},
        "review_count": 2,
    }
    vendor = explore_vendor_row_from_db(row)
    assert vendor.profile_form_data["businessName"] == "Wishes Group Ltd"
    assert vendor.profile_form_data["servicesOffered"] == ["photography"]
    assert vendor.review_count == 2


def test_explore_vendor_row_constructor_accepts_profile_form_data_name():
    """populate_by_name must allow field names (not only DB aliases)."""
    vendor = ExploreVendorRow(
        user_id="abc-123",
        approval_status="approved",
        profile_form_data={"businessName": "Named via field"},
    )
    assert vendor.profile_form_data["businessName"] == "Named via field"


def test_explore_vendor_row_constructor_accepts_payload_alias():
    vendor = ExploreVendorRow(
        user_id="abc-123",
        approval_status="approved",
        payload={"businessName": "Named via alias"},
    )
    assert vendor.profile_form_data["businessName"] == "Named via alias"


def test_admin_vendor_row_from_db_maps_payload_key():
    row = {
        "user_id": "abc-123",
        "status": "complete",
        "approval_status": "approved",
        "current_step": 5,
        "payload": {"businessName": "Admin List Co"},
    }
    vendor = admin_vendor_row_from_db(row)
    assert vendor.onboarding_status == "complete"
    assert vendor.profile_form_data["businessName"] == "Admin List Co"


def test_admin_vendor_row_constructor_accepts_profile_form_data_name():
    vendor = AdminVendorRow(
        user_id="abc-123",
        approval_status="approved",
        profile_form_data={"businessName": "Admin field name"},
    )
    assert vendor.profile_form_data["businessName"] == "Admin field name"


def test_vendor_profile_state_from_db_maps_payload_and_status():
    row = {
        "current_step": 3,
        "status": "submitted",
        "approval_status": "pending",
        "payload": {"businessName": "Profile Co", "baseCity": "London"},
        "updated_at": "2026-01-01T00:00:00Z",
        "payouts_verified": True,
        "listing_visible": False,
    }
    state = VendorProfileState.model_validate({**row, "success": True})
    assert state.onboarding_status == "submitted"
    assert state.profile_form_data["businessName"] == "Profile Co"
    assert state.profile_form_data["baseCity"] == "London"
    assert state.payouts_verified is True
