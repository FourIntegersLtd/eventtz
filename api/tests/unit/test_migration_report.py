"""`app.migration.report`: the `VerifyReport` <-> JSON round trip `report` relies on."""

from __future__ import annotations

from app.migration.report import render_verify_report, verify_report_from_json, verify_report_to_json
from app.migration.verify import SpotCheckMismatch, TableCountMismatch, VerifyReport


def _sample_report() -> VerifyReport:
    """A `VerifyReport` with one of everything, for the round-trip tests."""
    return VerifyReport(
        source_counts={"users": 650, "vendors": 175},
        target_counts={"users": 650, "vendors": 174},
        count_mismatches=[TableCountMismatch(table="vendors", source_count=175, target_count=174)],
        spot_checked_rows=10,
        spot_check_mismatches=[
            SpotCheckMismatch(
                table="users",
                row_id="abc-123",
                differing_columns={"email": ("a@example.com", "b@example.com")},
            )
        ],
        users_without_password_hash=["orphan@example.com"],
    )


def test_verify_report_round_trips_through_json() -> None:
    original = _sample_report()
    restored = verify_report_from_json(verify_report_to_json(original))
    assert restored == original


def test_verify_report_to_json_marks_a_mismatched_report_not_clean() -> None:
    payload = verify_report_to_json(_sample_report())
    assert payload["clean"] is False


def test_verify_report_to_json_marks_a_clean_report_clean() -> None:
    clean = VerifyReport(source_counts={"users": 1}, target_counts={"users": 1})
    assert verify_report_to_json(clean)["clean"] is True


def test_render_verify_report_flags_mismatches() -> None:
    rendered = render_verify_report(_sample_report())
    assert "MISMATCH" in rendered
    assert "orphan@example.com" in rendered
    assert "NOT CLEAN" in rendered


def test_render_verify_report_says_clean_when_it_is() -> None:
    clean = VerifyReport(source_counts={"users": 1}, target_counts={"users": 1})
    assert render_verify_report(clean).endswith("CLEAN")
