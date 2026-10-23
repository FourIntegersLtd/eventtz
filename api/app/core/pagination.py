"""Shared offset/limit paging: query params, response base, a SQL page helper and LIKE escaping.

Every list route takes its page as `PageParams` (default `DEFAULT_LIST_LIMIT` rows) and answers
with a schema that extends `PagedResponse`, so `total`, `offset` and `limit` mean the same thing
everywhere (ADR 0011). `paged()` runs the count and the page together and always adds the row's
primary key to the sort, so rows never repeat or vanish between pages when the sort column ties.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import ColumnElement, Row, Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_LIST_LIMIT = 25
MAX_LIST_LIMIT = 200

# The escape character `contains_pattern` uses; pass it as `column.ilike(pattern, escape=LIKE_ESCAPE)`.
LIKE_ESCAPE = "\\"


@dataclass(frozen=True)
class PageParams:
    """Which slice of a list the caller asked for: skip `offset` rows, then take up to `limit`."""

    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


def page_params(
    *, default_limit: int = DEFAULT_LIST_LIMIT, max_limit: int = MAX_LIST_LIMIT
) -> Callable[..., PageParams]:
    """A FastAPI dependency that reads the `offset` and `limit` query params into a `PageParams`.

    Use `Depends(page_params())` for the standard bounds; a route whose frozen contract allows a
    larger page (the audit log takes 500) passes `max_limit`.
    """

    # No `from __future__ import annotations` in this module: FastAPI must read `max_limit`
    # from the closure, and a string annotation could not resolve it.
    def read_page(
        offset: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=max_limit)] = default_limit,
    ) -> PageParams:
        """Validate the query params and bundle them."""
        return PageParams(offset=offset, limit=limit)

    return read_page


class PagedResponse(BaseModel):
    """The `total/offset/limit` triple every paged list response carries next to its own rows."""

    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


def escape_like(term: str) -> str:
    """`term` with LIKE wildcards neutralised, so a search for `100%` or `a_b` matches literally."""
    escaped = term.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
    return escaped.replace("%", f"{LIKE_ESCAPE}%").replace("_", f"{LIKE_ESCAPE}_")


def contains_pattern(term: str) -> str:
    """The `%term%` pattern for a case-insensitive "contains" search, wildcards in `term` escaped.

    Always pair it with `escape=LIKE_ESCAPE`: `column.ilike(contains_pattern(term), escape=LIKE_ESCAPE)`.
    """
    return f"%{escape_like(term)}%"


async def paged(
    session: AsyncSession,
    query: Select[Any],
    *,
    order_by: Sequence[ColumnElement[Any]],
    tie_breaker: ColumnElement[Any],
    offset: int,
    limit: int,
    count_query: Select[Any] | None = None,
) -> tuple[Sequence[Row[Any]], int]:
    """One page of `query` and the total number of matching rows.

    `order_by` is the visible sort; `tie_breaker` (the row's primary key) is appended so equal sort
    values still page deterministically. Services keep passing plain `offset`/`limit` ints (a
    router unpacks its `PageParams`). `count_query` overrides the default count, which wraps
    `query` as a subquery (give one when `query` selects duplicate column names).
    """
    count_source = (
        count_query
        if count_query is not None
        else select(func.count()).select_from(query.order_by(None).subquery())
    )
    total = int((await session.execute(count_source)).scalar_one())
    page_query = query.order_by(*order_by, tie_breaker).offset(offset).limit(limit)
    result = await session.execute(page_query)
    return result.all(), total


# The standard page dependency: `page: PageDep` in a router gives 25 rows by default, 200 at most.
PageDep = Annotated[PageParams, Depends(page_params())]
