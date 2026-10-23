"""Every paged list route takes its page as `PageParams`, and every paged response extends `PagedResponse`.

ADR 0011: one default page size, one validation, one `total/offset/limit` shape. A router that
declares its own `offset` query param, or a schema that redeclares the `total/offset/limit`
triple, is a second copy that drifts (a different default, a missing cap, a renamed field).
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, parse, python_files, rel

# (path under features/, parameter) -> why it is not the standard page.
ALLOWED_OWN_OFFSETS: dict[tuple[str, str], str] = {
    ("admin_insights/router.py", "category_offset"): (
        "pages one table inside the marketplace analytics dashboard (frozen contract), not the route's rows"
    ),
}


def hand_rolled_offsets(path: Path) -> list[tuple[str, str]]:
    """(route function, parameter) for each `offset` query param a router declares itself."""
    found: list[tuple[str, str]] = []
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            for argument in [*node.args.args, *node.args.kwonlyargs]:
                if argument.arg == "offset" or argument.arg.endswith("_offset"):
                    found.append((node.name, argument.arg))
    return found


def router_files() -> list[Path]:
    """Every `router*.py` in every slice."""
    return [path for path in python_files(FEATURES_ROOT) if path.name.startswith("router")]


def schema_files() -> list[Path]:
    """Every `schemas*.py` in every slice."""
    return [path for path in python_files(FEATURES_ROOT) if path.name.startswith("schemas")]


def redeclared_page_fields(path: Path) -> list[str]:
    """Classes that declare both `offset` and `limit` fields instead of extending `PagedResponse`."""
    found: list[str] = []
    for node in ast.walk(parse(path)):
        if isinstance(node, ast.ClassDef):
            fields = {
                statement.target.id
                for statement in node.body
                if isinstance(statement, ast.AnnAssign) and isinstance(statement.target, ast.Name)
            }
            if {"offset", "limit"} <= fields:
                found.append(node.name)
    return found


@pytest.mark.parametrize("path", router_files(), ids=rel)
def test_routers_page_with_page_params(path: Path) -> None:
    key = path.relative_to(FEATURES_ROOT).as_posix()
    own = [
        (function, name)
        for function, name in hand_rolled_offsets(path)
        if (key, name) not in ALLOWED_OWN_OFFSETS
    ]
    assert not own, (
        f"{rel(path)} declares its own offset parameter in {own}. Take `page: PageDep` "
        "(core/pagination.py) so the default size and caps stay in one place."
    )


@pytest.mark.parametrize("path", schema_files(), ids=rel)
def test_paged_responses_extend_paged_response(path: Path) -> None:
    bad = redeclared_page_fields(path)
    assert not bad, f"{rel(path)}: {bad} redeclare offset/limit. Extend `core.pagination.PagedResponse`."


def test_every_allowed_offset_still_exists() -> None:
    """A stale entry would silently license a future hand-rolled offset of the same name."""
    live = {
        (path.relative_to(FEATURES_ROOT).as_posix(), name)
        for path in router_files()
        for _function, name in hand_rolled_offsets(path)
    }
    assert sorted(set(ALLOWED_OWN_OFFSETS) - live) == []


def test_the_guard_would_catch_a_hand_rolled_page(tmp_path: Path) -> None:
    router = tmp_path / "router.py"
    router.write_text(
        "async def listing(session, offset: int = 0, limit: int = 50): ...\n"
        "async def standard(session, page: PageDep): ...\n",
        encoding="utf-8",
    )
    schema = tmp_path / "schemas.py"
    schema.write_text(
        "class Listing(BaseModel):\n    total: int = 0\n    offset: int = 0\n    limit: int = 50\n"
        "class Fine(PagedResponse):\n    rows: list[int] = []\n",
        encoding="utf-8",
    )
    assert hand_rolled_offsets(router) == [("listing", "offset")]
    assert redeclared_page_fields(schema) == ["Listing"]
