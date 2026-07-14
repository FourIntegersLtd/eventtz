"""Sanitize blog HTML to a safe allowlist for public rendering."""

from __future__ import annotations

from html.parser import HTMLParser


_ALLOWED_TAGS = frozenset(
    {
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "blockquote",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "a",
        "img",
        "span",
    }
)

_ALLOWED_ATTRS: dict[str, frozenset[str]] = {
    "a": frozenset({"href", "title", "rel", "target"}),
    "img": frozenset({"src", "alt", "title"}),
}


def _safe_href(value: str) -> str | None:
    v = (value or "").strip()
    if not v:
        return None
    lower = v.lower()
    if lower.startswith(("http://", "https://", "mailto:", "/")):
        return v
    return None


def _safe_src(value: str) -> str | None:
    v = (value or "").strip()
    if not v:
        return None
    lower = v.lower()
    if lower.startswith(("https://", "http://", "/")):
        return v
    return None


class _SanitizeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []
        self._stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_l = tag.lower()
        if tag_l not in _ALLOWED_TAGS:
            return
        allowed = _ALLOWED_ATTRS.get(tag_l, frozenset())
        kept: list[str] = []
        for name, raw in attrs:
            if not name or name.lower() not in allowed:
                continue
            n = name.lower()
            val = raw or ""
            if tag_l == "a" and n == "href":
                safe = _safe_href(val)
                if not safe:
                    continue
                kept.append(f'href="{_escape_attr(safe)}"')
                kept.append('rel="noopener noreferrer"')
                continue
            if tag_l == "img" and n == "src":
                safe = _safe_src(val)
                if not safe:
                    continue
                kept.append(f'src="{_escape_attr(safe)}"')
                continue
            if n == "target":
                if val.lower() != "_blank":
                    continue
                kept.append('target="_blank"')
                continue
            kept.append(f'{n}="{_escape_attr(val)}"')
        attr_s = (" " + " ".join(kept)) if kept else ""
        if tag_l == "br":
            self._out.append("<br />")
            return
        if tag_l == "img":
            # require src
            if not any(a.startswith("src=") for a in kept):
                return
            self._out.append(f"<img{attr_s} />")
            return
        self._stack.append(tag_l)
        self._out.append(f"<{tag_l}{attr_s}>")

    def handle_endtag(self, tag: str) -> None:
        tag_l = tag.lower()
        if tag_l not in _ALLOWED_TAGS or tag_l in ("br", "img"):
            return
        if self._stack and self._stack[-1] == tag_l:
            self._stack.pop()
            self._out.append(f"</{tag_l}>")
        elif tag_l in self._stack:
            while self._stack:
                t = self._stack.pop()
                self._out.append(f"</{t}>")
                if t == tag_l:
                    break

    def handle_data(self, data: str) -> None:
        self._out.append(_escape_text(data))

    def get_html(self) -> str:
        while self._stack:
            t = self._stack.pop()
            self._out.append(f"</{t}>")
        return "".join(self._out)


def _escape_text(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _escape_attr(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def sanitize_blog_html(raw: str | None) -> str:
    if not raw:
        return ""
    parser = _SanitizeParser()
    try:
        parser.feed(raw)
        parser.close()
    except Exception:
        return ""
    return parser.get_html().strip()
