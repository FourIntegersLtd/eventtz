"""Every slice explains itself: its README has the four headings agents rely on."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.guards._scan import rel, slice_dirs

# Headings agents and new engineers rely on to understand a slice before reading its code.
REQUIRED = ("## Purpose", "## Use cases", "## Invariants", "## Routes")


def missing(readme: Path) -> list[str]:
    """Required headings absent from the README (or the README itself)."""
    if not readme.exists():
        return ["README.md"]
    text = readme.read_text(encoding="utf-8")
    return [heading for heading in REQUIRED if heading not in text]


@pytest.mark.parametrize("slice_dir", slice_dirs(), ids=lambda slice_dir: slice_dir.name)
def test_slice_readme_has_required_headings(slice_dir: Path) -> None:
    gaps = missing(slice_dir / "README.md")
    assert not gaps, f"{rel(slice_dir)} README is missing {gaps}"


def test_the_guard_would_catch_a_missing_heading(tmp_path: Path) -> None:
    readme = tmp_path / "README.md"
    readme.write_text("# x\n## Purpose\n## Routes\n", encoding="utf-8")
    assert missing(readme) == ["## Use cases", "## Invariants"]
