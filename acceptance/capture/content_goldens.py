"""Capture the content slice's goldens from the baseline: blog HTML sanitizing and slugs.

Run with `make capture SCRIPT=capture/content_goldens.py` (never directly): the
runner puts the baseline code on `sys.path` and passes the golden folder as the
only argument. Output is `content/sanitize_blog_html.json` and `content/slugify.json`,
each a list of `{"input": ..., "output": ...}` pairs that api/ must match exactly.

Add a case here whenever the api/ implementation takes a branch no case covers,
then re-capture: the baseline, not the new code, decides the expected output.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.features.blog.sanitize import sanitize_blog_html  # type: ignore[import-not-found]
from app.features.blog.service import slugify  # type: ignore[import-not-found]

# HTML the blog editor (or a hostile admin) might send, one branch of the sanitizer each.
SANITIZE_CASES: list[str | None] = [
    None,
    "",
    "   ",
    "plain text",
    "  <p>trimmed</p>  ",
    "<p>Hello <b>bold</b> <strong>strong</strong> <em>em</em> <i>i</i> <u>u</u> <s>s</s></p>",
    "<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>",
    "<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>",
    "<blockquote>quoted<br>line<br/>break</blockquote>",
    "<P CLASS='x' STYLE='color:red'>Upper-case tags and attributes</P>",
    '<p onclick="steal()" style="x" id="y">handlers and styles dropped</p>',
    "<script>alert('x')</script>after",
    "<style>p{color:red}</style>after",
    "<iframe src='https://evil.example'></iframe>after",
    "<div><section>unknown wrappers</section></div>",
    '<a href="https://example.com" title="T">safe link</a>',
    '<a href="http://example.com" rel="nofollow">http link</a>',
    '<a href="/vendors">relative link</a>',
    '<a href="mailto:hello@example.com">mail</a>',
    '<a href="javascript:alert(1)">js link</a>',
    '<a href="JaVaScRiPt:alert(1)">mixed-case js</a>',
    '<a href="data:text/html,hi">data link</a>',
    '<a href="  https://spaced.example  ">spaced href</a>',
    '<a href="">empty href</a>',
    '<a href="https://example.com" target="_blank">new tab</a>',
    '<a href="https://example.com" target="_self">same tab</a>',
    '<a href="https://example.com" target="_BLANK">upper target</a>',
    '<a href="https://example.com?a=1&b=2">ampersand</a>',
    '<a href="https://example.com/"quote">quote in href</a>',
    '<img src="https://cdn.example.com/a.jpg" alt="A" title="T" loading="lazy">',
    '<img src="/local.png" alt="local" loading="eager">',
    '<img src="javascript:alert(1)" alt="bad">',
    '<img alt="no src">',
    '<img src="data:image/png;base64,AAAA">',
    '<figure class="blog-figure"><img src="https://x.example/i.png"><figcaption>cap</figcaption></figure>',
    '<figure class="other"><figcaption>other class</figcaption></figure>',
    '<span data-x="1">span attrs dropped</span>',
    "<p>unclosed <b>bold <i>italic</p>after",
    "<p>stray close</b></p>",
    "</p>close without open",
    "<p>nested <b>b <i>i</b> tail</i></p>",
    "Tom &amp; Jerry &lt;3 &gt; &quot;quotes&quot; &#169; &copy;",
    "raw < and > and & in text",
    "<!-- a comment --><p>after comment</p>",
    "<p>emoji 🎉 and accents café</p>",
    "<br><br/><br />",
    "<p>line one\nline two</p>",
]

# Titles and slugs as admins type them.
SLUGIFY_CASES: list[str] = [
    "",
    "   ",
    "Hello World",
    "  Leading and trailing  ",
    "Already-a-slug",
    "UPPER case",
    "Wedding DJs: 10 tips & tricks!",
    "multiple   spaces --- and dashes",
    "!!!",
    "café crème",
    "2026 events",
    "a" * 200,
    "-edge-dashes-",
    "under_score and.dot",
]


def pairs(function: object, cases: list[str | None] | list[str]) -> list[dict[str, str | None]]:
    """Each case with what the baseline `function` returns for it."""
    return [{"input": case, "output": function(case)} for case in cases]  # type: ignore[operator]


def write(path: Path, captured: list[dict[str, str | None]]) -> None:
    """Write one golden file as stable, readable JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    golden_root = Path(sys.argv[1]) / "content"
    write(golden_root / "sanitize_blog_html.json", pairs(sanitize_blog_html, SANITIZE_CASES))
    write(golden_root / "slugify.json", pairs(slugify, SLUGIFY_CASES))
