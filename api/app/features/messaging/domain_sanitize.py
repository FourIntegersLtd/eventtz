"""Cleaning staff-written support messages down to a small, safe set of HTML.

Staff write support messages in a rich-text editor, so the body arrives as HTML.
Only simple formatting and links survive; everything else is dropped, and text is
escaped. Ported byte for byte from the baseline's `chat/sanitize.py`: the web
renders stored bodies as HTML, so any change here changes what users see.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser

_ALLOWED_TAGS = frozenset(
    {"p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "a"}
)
_ALLOWED_ATTRIBUTES: dict[str, frozenset[str]] = {"a": frozenset({"href", "title", "rel", "target"})}
# Link targets that cannot run script: web, mail and same-site paths.
_SAFE_HREF_PREFIXES = ("http://", "https://", "mailto:", "/")
_TAG_PATTERN = re.compile(r"<[^>]+>")


def _safe_href(value: str) -> str | None:
    """The link target if it is a web, mail or same-site link, else `None` (drops `javascript:`)."""
    stripped = (value or "").strip()
    if not stripped:
        return None
    return stripped if stripped.lower().startswith(_SAFE_HREF_PREFIXES) else None


def _escape_text(text: str) -> str:
    """Escape text content so it cannot open a tag."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _escape_attribute(value: str) -> str:
    """Escape an attribute value for use inside double quotes."""
    return value.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


class _SanitizingParser(HTMLParser):
    """Re-emits only allowed tags and attributes, closing whatever the input left open."""

    def __init__(self) -> None:
        """Start with empty output and no open tags."""
        super().__init__(convert_charrefs=True)
        self._output: list[str] = []
        self._open_tags: list[str] = []

    def _kept_attributes(self, tag: str, attributes: list[tuple[str, str | None]]) -> list[str]:
        """The allowed attributes of one tag, rendered. A kept `href` always brings `rel=noopener`."""
        allowed = _ALLOWED_ATTRIBUTES.get(tag, frozenset())
        kept: list[str] = []
        for raw_name, raw_value in attributes:
            if not raw_name or raw_name.lower() not in allowed:
                continue
            name = raw_name.lower()
            value = raw_value or ""
            if tag == "a" and name == "href":
                safe_href = _safe_href(value)
                if not safe_href:
                    continue
                kept.append(f'href="{_escape_attribute(safe_href)}"')
                kept.append('rel="noopener noreferrer"')
                continue
            if name == "target":
                if value.lower() == "_blank":
                    kept.append('target="_blank"')
                continue
            kept.append(f'{name}="{_escape_attribute(value)}"')
        return kept

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """Emit an allowed opening tag (`br` self-closes) and remember it as open."""
        tag_name = tag.lower()
        if tag_name not in _ALLOWED_TAGS:
            return
        kept = self._kept_attributes(tag_name, attrs)
        if tag_name == "br":
            self._output.append("<br />")
            return
        rendered_attributes = (" " + " ".join(kept)) if kept else ""
        self._open_tags.append(tag_name)
        self._output.append(f"<{tag_name}{rendered_attributes}>")

    def handle_endtag(self, tag: str) -> None:
        """Close an open tag, closing any tags opened inside it first. Stray closers are dropped."""
        tag_name = tag.lower()
        if tag_name not in _ALLOWED_TAGS or tag_name == "br":
            return
        if self._open_tags and self._open_tags[-1] == tag_name:
            self._open_tags.pop()
            self._output.append(f"</{tag_name}>")
        elif tag_name in self._open_tags:
            while self._open_tags:
                closed = self._open_tags.pop()
                self._output.append(f"</{closed}>")
                if closed == tag_name:
                    break

    def handle_data(self, data: str) -> None:
        """Emit text, escaped."""
        self._output.append(_escape_text(data))

    def html(self) -> str:
        """The cleaned HTML, with every tag still open closed at the end."""
        while self._open_tags:
            self._output.append(f"</{self._open_tags.pop()}>")
        return "".join(self._output)


def sanitize_message_html(raw: str | None) -> str:
    """The safe HTML for a staff message; "" when there is nothing or the input cannot be parsed."""
    if not raw:
        return ""
    parser = _SanitizingParser()
    try:
        parser.feed(raw)
        parser.close()
    except Exception:
        return ""
    return parser.html().strip()


def message_plain_text(html: str | None) -> str:
    """The visible text of a message: tags removed, the five common entities decoded, trimmed."""
    if not html:
        return ""
    text = _TAG_PATTERN.sub("", html)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return text.strip()
