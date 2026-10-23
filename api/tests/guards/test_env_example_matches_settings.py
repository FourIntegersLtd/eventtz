"""`.env.example` lists exactly the keys `Settings` reads (a new setting needs both; AGENTS.md).

A setting missing from the example is invisible to a new engineer and to the deploy checklist; a key in
the example that no field reads is a dead knob someone will set and wonder why nothing changes.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.core.settings import Settings
from tests.guards._scan import PROJECT_ROOT

ENV_EXAMPLE = PROJECT_ROOT / ".env.example"
KEY_LINE = re.compile(r"^([A-Z][A-Z0-9_]*)=")


def example_keys(path: Path) -> set[str]:
    """Upper-case keys assigned on uncommented lines of an env file."""
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        match = KEY_LINE.match(line)
        if match:
            keys.add(match.group(1))
    return keys


def setting_keys() -> set[str]:
    """The env var name of every `Settings` field."""
    return {name.upper() for name in Settings.model_fields}


def test_env_example_lists_every_setting_and_nothing_else() -> None:
    keys = example_keys(ENV_EXAMPLE)
    assert (sorted(setting_keys() - keys), sorted(keys - setting_keys())) == ([], []), (
        "(missing from .env.example, not a Settings field): add the key with a safe empty or local "
        "default, or delete the dead key"
    )


def test_the_guard_reads_assignments_not_comments(tmp_path: Path) -> None:
    planted = tmp_path / ".env.example"
    planted.write_text("# COMMENTED=1\nREAL=\nOTHER=x  # note\n  INDENTED=1\n", encoding="utf-8")
    assert example_keys(planted) == {"REAL", "OTHER"}
