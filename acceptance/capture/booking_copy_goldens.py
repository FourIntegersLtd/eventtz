"""Capture the in-app booking notification copy (title and body) the baseline shows.

Run with `make capture SCRIPT=capture/booking_copy_goldens.py`. Every kind the
database accepts, plus one it does not, is formatted for both portals with each
event-name / stored-body variant, through the baseline's
`format_booking_notification`. Output: `notifications/booking_copy.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, get_args

from app.features.notifications.copy import format_booking_notification  # type: ignore[import-not-found]
from app.features.notifications.service import BookingNotifyKind  # type: ignore[import-not-found]

# A kind the table has no copy for, to pin the generic fallback.
UNKNOWN_KIND = "something_new"
EVENT_NAMES: list[str | None] = [None, "", "   ", "  Ada's 30th  "]
STORED_BODIES: list[str | None] = [None, "", "  \n ", "  New total: GBP 250.  "]


def capture_cases() -> list[dict[str, Any]]:
    """Every (kind, portal, event name, stored body) combination and the baseline's output."""
    cases: list[dict[str, Any]] = []
    for kind in [*get_args(BookingNotifyKind), UNKNOWN_KIND]:
        for portal in ("client", "vendor"):
            for event_name in EVENT_NAMES:
                for stored_body in STORED_BODIES:
                    title, body = format_booking_notification(
                        kind=kind, portal=portal, event_name=event_name, stored_body=stored_body
                    )
                    cases.append(
                        {
                            "input": {
                                "kind": kind,
                                "portal": portal,
                                "event_name": event_name,
                                "stored_body": stored_body,
                            },
                            "title": title,
                            "body": body,
                        }
                    )
    return cases


def main(golden_root: Path) -> None:
    """Write `notifications/booking_copy.json` under the golden directory."""
    target = golden_root / "notifications" / "booking_copy.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    cases = capture_cases()
    target.write_text(json.dumps(cases, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
