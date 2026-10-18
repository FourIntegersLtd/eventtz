"""Every tracked source file has exactly one owner agent in `.claude/OWNERS.md`.

A file with no owner is a file no agent reads the area rules for; a file with two
owners is one two agents will edit at once. Both fail here, so adding a file in a
new place forces the table to say who owns it. The Stop hook
(`.claude/hooks/quality-gate.sh`) imports `parse_rows` from this file to find the
owners of a change, so keep its signature.

Row format in OWNERS.md: ``| `glob`, `glob`, `!excluded-glob` | owner |``.
`*` matches within one path segment, `**` across segments, `{a,b}` is expanded,
and a `!` glob removes files from the row.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OWNERS_FILE = REPO_ROOT / ".claude" / "OWNERS.md"

GIT = shutil.which("git") or "git"
APPS = ("api/", "web/", "acceptance/")
SOURCE_SUFFIXES = (".py", ".ts", ".tsx", ".mjs", ".js", ".sql", ".sh")
# `next-env.d.ts` is written by Next itself.
GENERATED = ("web/next-env.d.ts",)
SKIPPED_PARTS = ("node_modules", "__pycache__")

ROW = re.compile(r"^\|\s*(?P<globs>`[^|]+?)\s*\|\s*(?P<owner>[a-z-]+-owner)\s*\|\s*$")
BRACES = re.compile(r"\{([^{}]*)\}")


def expand_braces(glob: str) -> list[str]:
    """Every alternative of a glob's `{a,b}` groups: `x/{a,b}.py` -> `x/a.py`, `x/b.py`."""
    match = BRACES.search(glob)
    if match is None:
        return [glob]
    expanded: list[str] = []
    for option in match.group(1).split(","):
        expanded.extend(expand_braces(glob[: match.start()] + option + glob[match.end() :]))
    return expanded


def glob_to_regex(glob: str) -> re.Pattern[str]:
    """A brace-free glob as an anchored regex (`*` one segment, `**` any depth)."""
    pattern = ""
    index = 0
    while index < len(glob):
        if glob.startswith("**/", index):
            pattern += "(?:.*/)?"
            index += 3
        elif glob.startswith("**", index):
            pattern += ".*"
            index += 2
        elif glob[index] == "*":
            pattern += "[^/]*"
            index += 1
        elif glob[index] == "?":
            pattern += "[^/]"
            index += 1
        else:
            pattern += re.escape(glob[index])
            index += 1
    return re.compile(pattern + r"\Z")


class Row:
    """One OWNERS.md row: the owner and the include and exclude patterns it claims."""

    def __init__(self, owner: str, globs: list[str]) -> None:
        """Compile the row's globs; a `!` prefix makes a glob an exclusion."""
        self.owner = owner
        self.text = ", ".join(globs)
        included = [glob for glob in globs if not glob.startswith("!")]
        excluded = [glob[1:] for glob in globs if glob.startswith("!")]
        self.include = [glob_to_regex(option) for glob in included for option in expand_braces(glob)]
        self.exclude = [glob_to_regex(option) for glob in excluded for option in expand_braces(glob)]

    def matches(self, path: str) -> bool:
        """Whether this row claims a repo-relative path."""
        included = any(pattern.match(path) for pattern in self.include)
        return included and not any(pattern.match(path) for pattern in self.exclude)


def split_globs(cell: str) -> list[str]:
    """Split a row's path cell on the commas that are not inside braces."""
    parts: list[str] = []
    depth = 0
    current = ""
    for char in cell:
        depth += (char == "{") - (char == "}")
        if char == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    return [part.strip().strip("`") for part in [*parts, current] if part.strip()]


def parse_rows(text: str) -> list[Row]:
    """Every owner row in the OWNERS.md text (the header and prose are skipped)."""
    rows: list[Row] = []
    for line in text.splitlines():
        match = ROW.match(line)
        if match:
            rows.append(Row(match["owner"], split_globs(match["globs"])))
    return rows


def tracked_source_files() -> list[str]:
    """Tracked files plus new ones not yet added.

    A new file without an owner fails here before it is committed, not first in CI.
    """
    listing = subprocess.run(  # noqa: S603 - fixed argv, no user input
        [GIT, "ls-files", "--cached", "--others", "--exclude-standard"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    return [
        path
        for path in listing
        if path.startswith(APPS)
        and path.endswith(SOURCE_SUFFIXES)
        and path not in GENERATED
        and not any(part in path.split("/") for part in SKIPPED_PARTS)
    ]


def owners_per_file(paths: list[str], rows: list[Row]) -> dict[str, list[str]]:
    """For each path, the text of every row that claims it."""
    return {path: [row.text for row in rows if row.matches(path)] for path in paths}


def test_row_exclude_glob_removes_a_path() -> None:
    """A `!` glob carves files out of a broader include."""
    row = Row("x-owner", ["web/lib/**", "!web/lib/validation/**"])
    assert row.matches("web/lib/axios.ts")
    assert not row.matches("web/lib/validation/money.ts")


def test_row_brace_expansion_matches_each_alternative() -> None:
    """`{a,b}` matches each alternative and nothing else."""
    row = Row("x-owner", ["web/features/{chat,notifications}/**"])
    assert row.matches("web/features/chat/ChatDrawer.tsx")
    assert row.matches("web/features/notifications/NotificationBell.tsx")
    assert not row.matches("web/features/bookings/BookingListPanel.tsx")


def test_every_source_file_has_exactly_one_owner() -> None:
    """The table covers the whole tree, with no file claimed twice."""
    rows = parse_rows(OWNERS_FILE.read_text(encoding="utf-8"))
    claims = owners_per_file(tracked_source_files(), rows)
    unowned = sorted(path for path, hits in claims.items() if not hits)
    shared = sorted(f"{path}: {hits}" for path, hits in claims.items() if len(hits) > 1)
    assert not unowned, f"{len(unowned)} files match no row in .claude/OWNERS.md: {unowned[:25]}"
    assert not shared, f"{len(shared)} files match two rows in .claude/OWNERS.md: {shared[:25]}"


def test_the_guard_would_catch_a_file_in_no_row() -> None:
    """A file in a folder the table never names is reported as unowned."""
    rows = parse_rows(OWNERS_FILE.read_text(encoding="utf-8"))
    claims = owners_per_file(["api/app/features/not_a_slice/router.py"], rows)
    assert claims == {"api/app/features/not_a_slice/router.py": []}


def test_every_row_owner_has_an_agent_file() -> None:
    """Each owner named in the table is a real agent, and each owner agent owns something."""
    owners = {row.owner for row in parse_rows(OWNERS_FILE.read_text(encoding="utf-8"))}
    agents = {path.stem for path in (REPO_ROOT / ".claude" / "agents").glob("*-owner.md")}
    assert owners == agents
