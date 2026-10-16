"""No source file names an OpenAI model that retires on 2027-01-14.

gpt-4o, gpt-4o-mini, gpt-4.1 and gpt-4.1-mini (and their dated snapshots such as
gpt-4o-2024-08-06) stop answering on that date, so a default left on one of them
turns into a 503 overnight. Only runtime string literals count: comments never
parse and docstrings are skipped, so prose may still mention the old names. The
match is on the full ID, so the audio models gpt-4o-transcribe and gpt-4o-mini-tts,
which are not retiring, pass.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from tests.guards._scan import APP_ROOT, docstring_nodes, parse, python_files, rel

REPLACEMENT_MODEL = "gpt-6-luna"
RETIRING_MODEL_ID = re.compile(r"(gpt-4o|gpt-4o-mini|gpt-4\.1|gpt-4\.1-mini)(-\d{4}-\d{2}-\d{2})?")
SCANNED_FILES = python_files(APP_ROOT)


def violations(path: Path) -> list[str]:
    """`file:line` and ID of every runtime string literal that is exactly a retiring model ID."""
    tree = parse(path)
    docstrings = docstring_nodes(tree)
    return [
        f"{rel(path)}:{node.lineno} uses retiring model {node.value!r}; use {REPLACEMENT_MODEL!r}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and id(node) not in docstrings
        and RETIRING_MODEL_ID.fullmatch(node.value)
    ]


@pytest.mark.parametrize("path", SCANNED_FILES, ids=rel)
def test_no_retiring_model_ids(path: Path) -> None:
    """Every scanned source file is free of retiring model IDs."""
    found = violations(path)
    assert not found, "\n".join(found)


def test_the_guard_would_catch_a_retiring_model(tmp_path: Path) -> None:
    """A default, a dated snapshot and a keyword argument are all caught, with their lines."""
    planted = tmp_path / "planted.py"
    planted.write_text(
        'HELP_MODEL = "gpt-4o-mini"\nVISION = "gpt-4o-2024-08-06"\ncall(model="gpt-4.1")\n',
        encoding="utf-8",
    )
    assert [finding.split(" uses")[0] for finding in violations(planted)] == [
        "planted.py:1",
        "planted.py:2",
        "planted.py:3",
    ]
    assert "use 'gpt-6-luna'" in violations(planted)[0]


def test_the_guard_ignores_prose_and_audio_models(tmp_path: Path) -> None:
    """Docstrings, comments and the non-retiring audio models never trip it."""
    planted = tmp_path / "planted.py"
    planted.write_text(
        '"""We used to run on gpt-4o-mini."""\n'
        "# rollback used to be gpt-4o\n"
        'TRANSCRIBE = "gpt-4o-transcribe"\n'
        'SPEECH = "gpt-4o-mini-tts"\n'
        'CHAT = "gpt-6-luna"\n',
        encoding="utf-8",
    )
    assert violations(planted) == []
