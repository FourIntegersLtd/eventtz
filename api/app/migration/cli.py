"""`python -m app.migration <command> --source-url ... --target-url ...`

`adopt-auth --target-url ...` is the one the cut-over runs (`docs/runbooks/cutover.md`):
production stays on Supabase, so it copies Supabase Auth's password hashes into
`users` inside that one database (`adopt_auth.py`).

The other four move data between two databases, a path kept for leaving
Supabase later; run them in this order:

- `export --source-url ... --out-dir ...` — read the source, write files to `--out-dir`.
- `load --target-url ... --out-dir ...` — read those files, write the target.
- `verify --source-url ... --target-url ...` — compare the two live databases.
- `report --out-dir ...` — reprint the last `verify` run's `verify_report.json`.

Every command refuses to run against anything but a local database unless
`--i-have-approval-for-hosted` is given (`safety.py`); that decision belongs to
the user, made later from `docs/runbooks/cutover.md`, never to this script.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.migration import db
from app.migration.adopt_auth import run_adopt_auth
from app.migration.export import run_export
from app.migration.load import run_load
from app.migration.report import (
    render_export_manifest,
    render_load_report,
    render_verify_report,
    verify_report_from_json,
    write_verify_report,
)
from app.migration.safety import NotLocalDatabaseError, assert_local_only
from app.migration.verify import run_verify

# The default out-dir if the caller does not name one: never inside the repository.
# A predictable path in the world-writable temp directory is exactly what ruff's S108
# warns about for a *service* (another local user could pre-create it); this is a
# developer-run CLI for a rehearsal, always run with `--out-dir` for anything real
# (`docs/runbooks/cutover.md`), so the convenience default is an accepted trade-off.
DEFAULT_OUT_DIR = Path("/tmp/eventtz-cutover-rehearsal")  # noqa: S108


def _add_common_flags(parser: argparse.ArgumentParser) -> None:
    """`--out-dir` and `--i-have-approval-for-hosted`, shared by every subcommand."""
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Where export files live.")
    parser.add_argument(
        "--i-have-approval-for-hosted",
        action="store_true",
        help="Override the local-only safety check. The real cut-over is the user's decision; "
        "this tool otherwise refuses any URL that is not localhost/127.0.0.1.",
    )


def build_parser() -> argparse.ArgumentParser:
    """The `argparse` parser for `export` / `load` / `adopt-auth` / `verify` / `report`."""
    parser = argparse.ArgumentParser(prog="python -m app.migration", description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export", help="Dump the source database's data to --out-dir.")
    export_parser.add_argument("--source-url", required=True, help="postgresql:// URL of the source.")
    _add_common_flags(export_parser)

    load_parser = subparsers.add_parser("load", help="Load --out-dir's files into the target database.")
    load_parser.add_argument("--target-url", required=True, help="postgresql:// URL of the target.")
    _add_common_flags(load_parser)

    verify_parser = subparsers.add_parser("verify", help="Compare the live source and target databases.")
    verify_parser.add_argument("--source-url", required=True, help="postgresql:// URL of the source.")
    verify_parser.add_argument("--target-url", required=True, help="postgresql:// URL of the target.")
    verify_parser.add_argument(
        "--random-seed", type=int, default=None, help="Seed the spot check's row sample (tests only)."
    )
    _add_common_flags(verify_parser)

    adopt_parser = subparsers.add_parser(
        "adopt-auth", help="Copy auth.users' bcrypt hashes into users.password_hash, in one database."
    )
    adopt_parser.add_argument(
        "--target-url", required=True, help="postgresql:// URL of the Supabase database."
    )
    _add_common_flags(adopt_parser)

    report_parser = subparsers.add_parser("report", help="Reprint --out-dir's last verify_report.json.")
    _add_common_flags(report_parser)

    return parser


def _run_export(args: argparse.Namespace) -> int:
    """`export`: dump the source database's data to `args.out_dir`."""
    assert_local_only(args.source_url, approved_for_hosted=args.i_have_approval_for_hosted)
    with db.connect(args.source_url) as connection:
        manifest = run_export(connection, args.out_dir)
    print(render_export_manifest(manifest))  # noqa: T201 - CLI output, not a log line
    return 0


def _run_load(args: argparse.Namespace) -> int:
    """`load`: read `args.out_dir`'s files into the target database, in one transaction."""
    assert_local_only(args.target_url, approved_for_hosted=args.i_have_approval_for_hosted)
    with db.connect(args.target_url) as connection:
        rows_loaded, auth_report = run_load(connection, args.out_dir)
        connection.commit()
    print(render_load_report(rows_loaded, auth_report))  # noqa: T201
    return 0


def _run_adopt_auth(args: argparse.Namespace) -> int:
    """`adopt-auth`: copy password hashes from `auth.users` into `users`, in one transaction."""
    assert_local_only(args.target_url, approved_for_hosted=args.i_have_approval_for_hosted)
    with db.connect(args.target_url) as connection:
        report = run_adopt_auth(connection)
        connection.commit()
    print(report.render())  # noqa: T201 - CLI output, not a log line
    return 0


def _run_verify(args: argparse.Namespace) -> int:
    """`verify`: compare the live source and target databases, and save the report to `args.out_dir`."""
    assert_local_only(args.source_url, args.target_url, approved_for_hosted=args.i_have_approval_for_hosted)
    with db.connect(args.source_url) as source, db.connect(args.target_url) as target:
        report = run_verify(source, target, random_seed=args.random_seed)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    write_verify_report(report, args.out_dir)
    print(render_verify_report(report))  # noqa: T201
    return 0 if report.is_clean() else 1


def _run_report(args: argparse.Namespace) -> int:
    """`report`: reprint `args.out_dir`'s last `verify_report.json` without touching either database."""
    import json  # noqa: PLC0415 - only this command needs it

    report_path = args.out_dir / "verify_report.json"
    if not report_path.exists():
        print(f"no verify_report.json in {args.out_dir}; run `verify` first.", file=sys.stderr)  # noqa: T201
        return 1
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    report = verify_report_from_json(payload)
    print(render_verify_report(report))  # noqa: T201
    return 0 if report.is_clean() else 1


_HANDLERS = {
    "export": _run_export,
    "load": _run_load,
    "adopt-auth": _run_adopt_auth,
    "verify": _run_verify,
    "report": _run_report,
}


def main(argv: list[str] | None = None) -> int:
    """Parse arguments and run the chosen command, returning its exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return _HANDLERS[args.command](args)
    except NotLocalDatabaseError as error:
        print(f"refused: {error}", file=sys.stderr)  # noqa: T201
        return 2


if __name__ == "__main__":
    sys.exit(main())
