"""`python -m app.migration ...` entry point. See `cli.py` for the commands."""

from __future__ import annotations

import sys

from app.migration.cli import main

if __name__ == "__main__":
    sys.exit(main())
