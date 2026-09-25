"""Pure blog rules: slugs, the HTML allow-list sanitiser, and how an edit becomes a row update.

Everything here is pinned to the baseline by goldens in `tests/golden/content/`.
"""

from __future__ import annotations

import re
import uuid
from html.parser import HTMLParser
from typing import Any

DEFAULT_TITLE = "Untitled"
# The empty document the rich-text editor opens a new draft with.
NEW_POST_BODY: dict[str, Any] = {"type": "doc", "content": [{"type": "paragraph"}]}
# A slug is at most this long before any `-2` suffix is added.
SLUG_MAX_LENGTH = 180
# Numbered alternatives stop short of this: after `-2` … `-49` are taken, a random suffix is used
# (the baseline never tries `-50`; kept for parity).
LAST_NUMBERED_SLUG = 50
# Author names are cut to the column's intended length.
AUTHOR_NAME_MAX_LENGTH = 120

_NOT_SLUG_CHARACTERS = re.compile(r"[^a-z0-9]+")


def slugify(title: str) -> str:
    """`"Wedding DJs: 10 tips!"` → `"wedding-djs-10-tips"`; nothing usable left → `"post"`."""
    base = _NOT_SLUG_CHARACTERS.sub("-", (title or "").strip().lower()).strip("-")
    return (base or "post")[:SLUG_MAX_LENGTH]


def numbered_slug(base: str, number: int) -> str:
    """The `number`-th alternative for a taken slug: `base-2`, `base-3`, …"""
    return f"{base}-{number}"


def random_slug(base: str) -> str:
    """A slug that will not clash, for when the numbered ones ran out or could not be checked."""
    return f"{base}-{uuid.uuid4().hex[:8]}"


def is_uuid(value: str) -> bool:
    """True when `value` parses as a UUID (post ids and booking ids are UUIDs)."""
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True


def _trimmed_or_none(value: Any) -> str | None:
    """A non-blank string trimmed, anything else (blank, `None`, not a string) as `None`."""
    return value.strip() if isinstance(value, str) and value.strip() else None


def post_changes(fields: dict[str, Any]) -> dict[str, Any]:
    """Turn the fields an editor sent into column updates (all but `slug` and `updated_at`).

    Only keys present in `fields` are touched. A blank title becomes "Untitled";
    blank subtitle, cover, excerpt or author become NULL; `body_html` is sanitised.
    The slug needs a uniqueness check against the database, so the service handles it.
    """
    changes: dict[str, Any] = {}
    if fields.get("title") is not None:
        changes["title"] = str(fields["title"]).strip() or DEFAULT_TITLE
    for column in ("subtitle", "cover_image_url", "excerpt"):
        if column in fields:
            changes[column] = _trimmed_or_none(fields[column])
    if "author_name" in fields:
        author_name = _trimmed_or_none(fields["author_name"])
        changes["author_name"] = author_name[:AUTHOR_NAME_MAX_LENGTH] if author_name else None
    if fields.get("body_json") is not None:
        changes["body_json"] = fields["body_json"]
    if fields.get("body_html") is not None:
        changes["body_html"] = sanitize_blog_html(str(fields["body_html"]))
    return changes


# --- HTML sanitiser ------------------------------------------------------------------------------

# Tags the public blog page may render; everything else is dropped (its text is kept).
ALLOWED_TAGS = frozenset(
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
        "figure",
        "figcaption",
        "span",
    }
)
# Attributes kept per tag (all others, including every `on*` handler and `style`, are dropped).
ALLOWED_ATTRIBUTES: dict[str, frozenset[str]] = {
    "a": frozenset({"href", "title", "rel", "target"}),
    "img": frozenset({"src", "alt", "title", "loading"}),
    "figure": frozenset({"class"}),
}
# Tags that never have a closing tag.
_VOID_TAGS = ("br", "img")


def _safe_link(value: str) -> str | None:
    """A link target kept only for http(s), mailto and site-relative URLs (no `javascript:`)."""
    trimmed = (value or "").strip()
    if trimmed and trimmed.lower().startswith(("http://", "https://", "mailto:", "/")):
        return trimmed
    return None


def _safe_image_source(value: str) -> str | None:
    """An image source kept only for http(s) and site-relative URLs (no `data:` or `javascript:`)."""
    trimmed = (value or "").strip()
    if trimmed and trimmed.lower().startswith(("https://", "http://", "/")):
        return trimmed
    return None


def _escape_text(text: str) -> str:
    """Escape text between tags."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _escape_attribute(value: str) -> str:
    """Escape a value placed inside double-quoted attribute."""
    return value.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def _kept_attributes(tag: str, attributes: list[tuple[str, str | None]]) -> list[str]:
    """The `name="value"` pairs of an allowed tag that survive sanitising, in source order."""
    allowed = ALLOWED_ATTRIBUTES.get(tag, frozenset())
    kept: list[str] = []
    for raw_name, raw_value in attributes:
        if not raw_name or raw_name.lower() not in allowed:
            continue
        name = raw_name.lower()
        value = raw_value or ""
        if tag == "a" and name == "href":
            link = _safe_link(value)
            if link:
                # Every surviving link opens without giving the target page a handle on ours.
                kept.append(f'href="{_escape_attribute(link)}"')
                kept.append('rel="noopener noreferrer"')
        elif tag == "img" and name == "src":
            source = _safe_image_source(value)
            if source:
                kept.append(f'src="{_escape_attribute(source)}"')
        elif tag == "img" and name == "loading" and value.lower() == "lazy":
            kept.append('loading="lazy"')
        elif tag == "figure" and name == "class":
            if value.strip() == "blog-figure":
                kept.append('class="blog-figure"')
        elif name == "target":
            if value.lower() == "_blank":
                kept.append('target="_blank"')
        else:
            # Includes `loading="eager"`: only `lazy` is normalised, other values pass through.
            kept.append(f'{name}="{_escape_attribute(value)}"')
    return kept


class _AllowListParser(HTMLParser):
    """Streams HTML and re-emits only allowed tags and attributes, closing whatever was left open."""

    def __init__(self) -> None:
        """Start with empty output and no open tags."""
        super().__init__(convert_charrefs=True)
        self._output: list[str] = []
        self._open_tags: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        """Emit an allowed opening tag with its safe attributes; drop anything else."""
        tag_name = tag.lower()
        if tag_name not in ALLOWED_TAGS:
            return
        kept = _kept_attributes(tag_name, attrs)
        attribute_text = (" " + " ".join(kept)) if kept else ""
        if tag_name == "br":
            self._output.append("<br />")
            return
        if tag_name == "img":
            # An image without a safe source would render as a broken box, so drop it.
            if any(attribute.startswith("src=") for attribute in kept):
                self._output.append(f"<img{attribute_text} />")
            return
        self._open_tags.append(tag_name)
        self._output.append(f"<{tag_name}{attribute_text}>")

    def handle_endtag(self, tag: str) -> None:
        """Close an open allowed tag, closing any tags opened inside it first; ignore stray closers."""
        tag_name = tag.lower()
        if tag_name not in ALLOWED_TAGS or tag_name in _VOID_TAGS:
            return
        if self._open_tags and self._open_tags[-1] == tag_name:
            self._open_tags.pop()
            self._output.append(f"</{tag_name}>")
        elif tag_name in self._open_tags:
            while self._open_tags:
                closed_tag = self._open_tags.pop()
                self._output.append(f"</{closed_tag}>")
                if closed_tag == tag_name:
                    break

    def handle_data(self, data: str) -> None:
        """Keep text (including the text of dropped tags such as `<script>`), escaped."""
        self._output.append(_escape_text(data))

    def html(self) -> str:
        """The sanitised document, with every still-open tag closed."""
        while self._open_tags:
            self._output.append(f"</{self._open_tags.pop()}>")
        return "".join(self._output)


def sanitize_blog_html(raw_html: str | None) -> str:
    """Strip blog HTML down to the allow-list; `""` for empty input or HTML the parser cannot read."""
    if not raw_html:
        return ""
    parser = _AllowListParser()
    try:
        parser.feed(raw_html)
        parser.close()
    except Exception:
        return ""
    return parser.html().strip()
