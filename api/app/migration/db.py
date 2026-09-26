"""A plain, synchronous psycopg connection for a one-shot CLI run.

Everything else in `app/` talks to Postgres through `app.core.db`'s async
engine, sized for a long-running server. This package is a script that opens
one connection, does a bounded amount of work, and exits, so it uses psycopg
directly instead: one fewer moving part, and no event loop to wire a CLI
entry-point through.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg


def normalise(url: str) -> str:
    """A `postgresql+psycopg://` (SQLAlchemy) URL in the plain `postgresql://` form psycopg wants.

    Every other accepted prefix is already libpq's own, so it passes through unchanged.
    """
    prefix = "postgresql+psycopg://"
    if url.startswith(prefix):
        return "postgresql://" + url[len(prefix) :]
    return url


@contextmanager
def connect(url: str, *, autocommit: bool = False) -> Iterator[psycopg.Connection[tuple[Any, ...]]]:
    """One psycopg connection to `url`, closed when the block exits.

    `autocommit=True` is for statements that cannot run inside a transaction
    (`TRUNCATE ... RESTART IDENTITY` on some servers, session-level `SET`); the
    load itself still wraps its writes in one explicit transaction (`load.py`).
    """
    connection = psycopg.connect(normalise(url), autocommit=autocommit)
    try:
        yield connection
    finally:
        connection.close()
