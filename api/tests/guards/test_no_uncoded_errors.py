"""Feature code never raises `RuntimeError` or `ValueError` out to a request (an uncoded 500).

An unexpected exception becomes a bare `internal_error` the frontend cannot branch on. Raise an
`AppError` subclass with a stable `code` from the slice's `errors.py`. Two places legitimately use
`ValueError`: pydantic validators in `schemas*.py`, and the pure parsers in `ALLOWED`, whose callers
catch it and translate it into a coded error.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, parse, python_files, rel

BANNED = {"RuntimeError", "ValueError"}
# path under features/ -> who catches the ValueError and what coded error it becomes.
ALLOWED: dict[str, str] = {
    "vendors/domain_price_list.py": (
        "resolve_line_items rejects line items; bookings/service_create.py catches it as LineItemsInvalid"
    ),
}


def is_exempt(path: Path) -> bool:
    """Pydantic schema modules and the documented domain parsers."""
    return path.name.startswith("schemas") or path.relative_to(FEATURES_ROOT).as_posix() in ALLOWED


def uncoded_raises(path: Path) -> list[str]:
    """`raise RuntimeError(...)` / `raise ValueError(...)` statements in the file, with line numbers."""
    found = []
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.Raise) and node.exc is not None:
            target = node.exc.func if isinstance(node.exc, ast.Call) else node.exc
            if isinstance(target, ast.Name) and target.id in BANNED:
                found.append(f"line {node.lineno}: raise {target.id}")
    return sorted(found)


@pytest.mark.parametrize(
    "path", [path for path in python_files(FEATURES_ROOT) if not is_exempt(path)], ids=rel
)
def test_features_raise_coded_errors(path: Path) -> None:
    bad = uncoded_raises(path)
    assert not bad, (
        f"{rel(path)}: {bad}. Raise an AppError subclass with a stable code from the slice's errors.py."
    )


def test_every_allowed_parser_still_raises_value_error() -> None:
    """A stale entry would silently license a future uncoded raise in that file."""
    stale = [name for name in ALLOWED if not uncoded_raises(FEATURES_ROOT / name)]
    assert stale == []


def test_the_guard_would_catch_an_uncoded_raise(tmp_path: Path) -> None:
    planted = tmp_path / "service.py"
    planted.write_text(
        "def f(row):\n    if row is None:\n        raise RuntimeError('boom')\n    raise ValueError\n",
        encoding="utf-8",
    )
    assert uncoded_raises(planted) == ["line 3: raise RuntimeError", "line 4: raise ValueError"]


def test_the_guard_ignores_app_errors_and_catching(tmp_path: Path) -> None:
    planted = tmp_path / "service.py"
    planted.write_text(
        "def f():\n    try:\n        pass\n    except ValueError as error:\n"
        "        raise LineItemsInvalid() from error\n",
        encoding="utf-8",
    )
    assert uncoded_raises(planted) == []
