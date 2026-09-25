"""Logging to stdout: one compact line per event in production, readable blocks locally.

Railway collects stdout, so there are no log files.
"""

from __future__ import annotations

import logging
import sys

from app.core.settings import get_settings


def get_logger(name: str) -> logging.Logger:
    """A named logger; call with `__name__` so log lines show which module wrote them."""
    return logging.getLogger(name)


def setup_logging() -> None:
    """Replace the root handlers with one stdout handler at the configured level."""
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    line_format = (
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        if settings.is_production
        else "\n%(asctime)s | %(levelname)-8s | %(name)s\n%(message)s"
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(line_format, datefmt="%Y-%m-%d %H:%M:%S"))
    root_logger = logging.getLogger()
    root_logger.handlers[:] = [handler]
    root_logger.setLevel(level)
    # The HTTP libraries log every request at INFO; that drowns out our own lines.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
