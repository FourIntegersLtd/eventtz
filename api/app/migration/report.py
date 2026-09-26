"""`report`: turn a `VerifyReport` (plus what `export`/`load` did) into text a human can read.

Printed by `verify` itself, and rebuildable later from the JSON `verify`
also writes to `<out_dir>/verify_report.json`, so `report` can be re-run
without touching either database again.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.migration.export import ExportManifest
from app.migration.load import LoadReport
from app.migration.serialization import to_jsonable
from app.migration.tables import TARGET_ONLY_SCHEMAS, TARGET_ONLY_TABLES
from app.migration.verify import SpotCheckMismatch, TableCountMismatch, VerifyReport


def verify_report_to_json(report: VerifyReport) -> dict[str, Any]:
    """`report` as a JSON-safe dict, for `verify_report.json`.

    A spot-check mismatch holds the raw values psycopg read back (`Decimal`,
    `datetime`, `UUID`, ...), the same ones `export.py` cannot hand `json.dumps`
    unconverted either; `to_jsonable` is the same fix used there.
    """
    return {
        "source_counts": report.source_counts,
        "target_counts": report.target_counts,
        "count_mismatches": [asdict(mismatch) for mismatch in report.count_mismatches],
        "spot_checked_rows": report.spot_checked_rows,
        "spot_check_mismatches": [
            {
                "table": mismatch.table,
                "row_id": mismatch.row_id,
                "differing_columns": {
                    column: [to_jsonable(value) for value in values]
                    for column, values in mismatch.differing_columns.items()
                },
            }
            for mismatch in report.spot_check_mismatches
        ],
        "users_without_password_hash": report.users_without_password_hash,
        "clean": report.is_clean(),
    }


def verify_report_from_json(payload: dict[str, Any]) -> VerifyReport:
    """Rebuild a `VerifyReport` from the dict `verify_report_to_json` produced (round trip for `report`)."""
    count_mismatches = [TableCountMismatch(**item) for item in payload["count_mismatches"]]
    spot_check_mismatches = [
        SpotCheckMismatch(
            table=item["table"],
            row_id=item["row_id"],
            differing_columns={key: tuple(value) for key, value in item["differing_columns"].items()},
        )
        for item in payload["spot_check_mismatches"]
    ]
    return VerifyReport(
        source_counts=payload["source_counts"],
        target_counts=payload["target_counts"],
        count_mismatches=count_mismatches,
        spot_checked_rows=payload["spot_checked_rows"],
        spot_check_mismatches=spot_check_mismatches,
        users_without_password_hash=payload["users_without_password_hash"],
    )


def write_verify_report(report: VerifyReport, out_dir: Path) -> Path:
    """Save `report` as `<out_dir>/verify_report.json` and return the path."""
    path = out_dir / "verify_report.json"
    path.write_text(json.dumps(verify_report_to_json(report), indent=2), encoding="utf-8")
    return path


def render_verify_report(report: VerifyReport) -> str:
    """The human-readable form of a `VerifyReport`."""
    lines: list[str] = ["Row counts (source -> target):"]
    for table in sorted(report.source_counts):
        source_count = report.source_counts[table]
        target_count = report.target_counts[table]
        marker = " " if source_count == target_count else " MISMATCH "
        lines.append(f"  {table:<28} {source_count:>6} -> {target_count:>6}{marker}")
    lines.append("")
    lines.append(f"Spot check: {report.spot_checked_rows} rows sampled.")
    if report.spot_check_mismatches:
        lines.append(f"  {len(report.spot_check_mismatches)} mismatch(es):")
        for mismatch in report.spot_check_mismatches:
            lines.append(f"    {mismatch.table}#{mismatch.row_id}: {mismatch.differing_columns}")
    else:
        lines.append("  no mismatches.")
    lines.append("")
    if report.users_without_password_hash:
        no_password_count = len(report.users_without_password_hash)
        lines.append(f"Users with no password hash ({no_password_count}) — need a reset email:")
        for email in report.users_without_password_hash:
            lines.append(f"  {email}")
    else:
        lines.append("Every open user has a password hash.")
    lines.append("")
    target_only_tables = ", ".join(sorted(TARGET_ONLY_TABLES))
    lines.append(f"Target-only tables (never loaded; belong to api/ only): {target_only_tables}")
    lines.append("Target-only schemas (skipped entirely): " + ", ".join(TARGET_ONLY_SCHEMAS))
    lines.append("")
    lines.append("CLEAN" if report.is_clean() else "NOT CLEAN — see mismatches above.")
    return "\n".join(lines)


def render_load_report(rows_loaded: dict[str, int], load_report: LoadReport) -> str:
    """The human-readable form of what `load` did."""
    lines = ["Rows loaded per table:"]
    for table, count in rows_loaded.items():
        lines.append(f"  {table:<28} {count:>6}")
    lines.append("")
    lines.append(f"auth.users matched to a users row: {load_report.users_matched_to_auth}")
    lines.append(f"users given a password hash: {load_report.users_with_password_set}")
    if load_report.auth_rows_with_no_matching_user:
        orphan_count = len(load_report.auth_rows_with_no_matching_user)
        orphan_ids = ", ".join(load_report.auth_rows_with_no_matching_user)
        lines.append(f"auth.users rows with no matching users row ({orphan_count}): {orphan_ids}")
    return "\n".join(lines)


def render_export_manifest(manifest: ExportManifest) -> str:
    """The human-readable form of what `export` wrote."""
    lines = ["Rows exported per table:"]
    for table, count in manifest.public_row_counts.items():
        lines.append(f"  {table:<28} {count:>6}")
    lines.append("")
    lines.append(f"auth.users rows exported: {manifest.auth_users_row_count}")
    return "\n".join(lines)
