"""Write the OpenAPI document (`make openapi`) for the web app's generated types (ADR 0007)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.core.settings import API_ROOT


def write(path: Path = API_ROOT / "openapi.json") -> None:
    from app.main import create_app  # the app module imports every slice; load it only here

    document = create_app().openapi()
    path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write(Path(sys.argv[1]) if len(sys.argv) > 1 else API_ROOT / "openapi.json")
