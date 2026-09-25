"""Write the OpenAPI document (`make openapi`) that the web app generates its API types from (ADR 0007)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.core.settings import API_ROOT


def write(path: Path = API_ROOT / "openapi.json") -> None:
    """Build the app and write its OpenAPI schema as stable, sorted JSON so diffs stay readable."""
    from app.main import create_app  # the app module imports every slice; load it only here

    document = create_app().openapi()
    path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write(Path(sys.argv[1]) if len(sys.argv) > 1 else API_ROOT / "openapi.json")
