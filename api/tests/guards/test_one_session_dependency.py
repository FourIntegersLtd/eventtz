"""The request session is asked for one way: `core.db.SessionDep`.

FastAPI caches a dependency per scope, so `Depends(get_session)` spelt with
another scope would open a second session, and a second transaction, in the
same request. The default scope also commits after the response has gone out.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import CORE_ROOT, parse, python_files, rel

DECLARED_IN = CORE_ROOT / "db.py"


def session_dependencies(path: Path) -> int:
    """How many `Depends(get_session, ...)` calls the file makes."""
    return sum(
        1
        for node in ast.walk(parse(path))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "Depends"
        and node.args
        and isinstance(node.args[0], ast.Name)
        and node.args[0].id == "get_session"
    )


@pytest.mark.parametrize("path", [path for path in python_files() if path != DECLARED_IN], ids=rel)
def test_only_core_db_declares_the_session_dependency(path: Path) -> None:
    assert session_dependencies(path) == 0, f"{rel(path)} calls Depends(get_session); use core.db.SessionDep."


def test_the_guard_would_catch_a_second_spelling(tmp_path: Path) -> None:
    router = tmp_path / "router.py"
    router.write_text(
        "from typing import Annotated\n"
        "from fastapi import Depends\n"
        "from app.core.db import get_session\n"
        "Session = Annotated[object, Depends(get_session)]\n",
        encoding="utf-8",
    )
    assert session_dependencies(router) == 1
