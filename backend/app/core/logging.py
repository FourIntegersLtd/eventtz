"""Process-wide logging: level from settings; format differs dev vs production; rotating file."""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import get_settings

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def setup_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    if settings.is_production:
        log_format = "%(asctime)s | %(levelname)-8s | %(message)s"
    else:
        log_format = (
            "\n"
            "═══════════════════════════════════════════\n"
            "%(asctime)s | %(levelname)-8s | %(name)s\n"
            "───────────────────────────────────────────\n"
            "%(message)s\n"
        )

    datefmt = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(log_format, datefmt=datefmt)

    root = logging.getLogger()
    root.setLevel(level)

    if root.handlers:
        for h in root.handlers:
            root.removeHandler(h)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)
    stream_handler.setFormatter(formatter)
    root.addHandler(stream_handler)

    log_dir = _BACKEND_ROOT / settings.log_dir
    log_dir.mkdir(parents=True, exist_ok=True)
    file_path = log_dir / settings.log_file_name
    file_handler = RotatingFileHandler(
        file_path,
        maxBytes=settings.log_max_bytes,
        backupCount=settings.log_backup_count,
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
