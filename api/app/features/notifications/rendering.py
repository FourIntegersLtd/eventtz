"""Fill in the Jinja email templates in `templates/` (HTML is auto-escaped, text is not)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_ROOT = Path(__file__).resolve().parent / "templates"


@lru_cache(maxsize=1)
def _environment() -> Environment:
    """The shared Jinja environment, built once. Escapes `.html`/`.xml` templates only, like the baseline."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_ROOT)),
        autoescape=select_autoescape(["html", "xml"]),
    )


def render_template(template_name: str, context: dict[str, object]) -> str:
    """Render `template_name` (a path under `templates/`, e.g. `admin/alert.html`) with `context`."""
    return _environment().get_template(template_name).render(**context)
