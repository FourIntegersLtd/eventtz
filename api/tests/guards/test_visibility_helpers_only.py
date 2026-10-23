"""Public vendor visibility has one definition (AGENTS.md: never filter by `approval_status` by hand).

A query or check that decides what clients may see must go through `vendors.domain_visibility`
(`is_publicly_listable`) or its SQL twin `vendors.repository._publicly_listed`. Comparing
`approval_status` anywhere else is a second, drifting copy of that rule, so every such comparison
must be listed in `ALLOWED` with the reason it asks a different question (moderation workflow,
admin counts, referral-code eligibility), keyed by file and enclosing function.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.guards._scan import FEATURES_ROOT, parse, python_files, rel

ATTRIBUTE = "approval_status"
# (path under features/, function) -> why this is not a public-listing question.
ALLOWED: dict[tuple[str, str], str] = {
    ("vendors/repository.py", "_publicly_listed"): "the SQL twin of the source of truth",
    ("vendors/repository.py", "marketplace_vendors"): (
        "listed_only=False is the staff-designated QA path: approved vendors regardless of "
        "Stripe or override; the public path uses _publicly_listed"
    ),
    ("vendors/repository.py", "list_vendors"): "the admin review queue filter chosen by staff",
    ("vendors/repository.py", "payouts_nudge_candidates"): (
        "asks 'was this vendor approved long enough ago to be nudged about payouts', not 'is it listed'"
    ),
    ("vendors/service_moderation.py", "return_for_edits"): "moderation acts only on pending vendors",
    ("vendors/service_moderation.py", "_is_approved_without_payouts"): (
        "picks the approval email variant (approved but payouts unverified), not a listing"
    ),
    ("referrals/service_client_codes.py", "_approved_settings"): (
        "a referral code belongs to an approved vendor; unrelated to marketplace listing"
    ),
    ("referrals/service_client_codes.py", "_code_works_for_vendor"): (
        "referral-code eligibility needs approval, not a listing"
    ),
    ("admin_insights/repository.py", "count_vendors_by_approval"): "staff dashboard counts by status",
    ("admin_insights/repository.py", "count_vendors_total_and_active"): (
        "staff dashboard counts approved or submitted vendors, not the public listing"
    ),
}


def hand_written_comparisons(path: Path) -> list[tuple[str, int]]:
    """(enclosing function, line) of each comparison or `.in_()` on an `approval_status` attribute."""
    found: list[tuple[str, int]] = []

    def uses_attribute(node: ast.AST) -> bool:
        """True when the expression reads `<something>.approval_status`."""
        return any(isinstance(inner, ast.Attribute) and inner.attr == ATTRIBUTE for inner in ast.walk(node))

    def visit(node: ast.AST, function: str) -> None:
        """Walk down, remembering the nearest enclosing function name."""
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            function = node.name
        is_comparison = isinstance(node, ast.Compare) and uses_attribute(node)
        is_in_filter = (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "in_"
            and uses_attribute(node.func.value)
        )
        if isinstance(node, ast.Compare | ast.Call) and (is_comparison or is_in_filter):
            found.append((function, node.lineno))
        for child in ast.iter_child_nodes(node):
            visit(child, function)

    visit(parse(path), "<module>")
    return found


def unlisted(path: Path) -> list[tuple[str, int]]:
    """The comparisons in `path` that are not in `ALLOWED`."""
    key = path.relative_to(FEATURES_ROOT).as_posix() if path.is_relative_to(FEATURES_ROOT) else path.name
    return [
        (function, line)
        for function, line in hand_written_comparisons(path)
        if (key, function) not in ALLOWED
    ]


@pytest.mark.parametrize("path", python_files(FEATURES_ROOT), ids=rel)
def test_approval_status_is_not_compared_by_hand(path: Path) -> None:
    bad = unlisted(path)
    assert not bad, (
        f"{rel(path)} compares approval_status by hand at {bad}. Use vendors.domain_visibility / "
        "repository._publicly_listed for public listing, or add the function to ALLOWED with a reason."
    )


def test_every_allowed_entry_still_exists() -> None:
    """A stale entry would silently license a future hand-written comparison of the same name."""
    live = {
        (path.relative_to(FEATURES_ROOT).as_posix(), function)
        for path in python_files(FEATURES_ROOT)
        for function, _ in hand_written_comparisons(path)
    }
    assert sorted(set(ALLOWED) - live) == []


def test_the_guard_would_catch_a_hand_written_filter(tmp_path: Path) -> None:
    planted = tmp_path / "repository.py"
    planted.write_text(
        "def listed(query):\n    return query.where(Vendor.approval_status == 'approved')\n"
        "def many(query):\n    return query.where(Vendor.approval_status.in_(['approved']))\n"
        "def fine(vendor):\n    return vendor.status == 'x'\n",
        encoding="utf-8",
    )
    assert unlisted(planted) == [("listed", 2), ("many", 4)]
