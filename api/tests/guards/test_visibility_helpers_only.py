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


# Column methods that filter on a value: `.in_()` and its negation, and the NULL tests.
FILTER_METHODS = {"in_", "notin_", "not_in", "is_", "is_not", "isnot"}


def hand_written_comparisons(path: Path) -> list[tuple[str, int]]:
    """(enclosing function, line) of each hand-written test on `approval_status`.

    Caught: `==`/`!=`/`in` comparisons, column filters (`.in_`, `.notin_`, `.is_`, `.is_not`),
    `filter_by(approval_status=...)`, and the same comparisons on a dict row (`row["approval_status"]`,
    `row.get("approval_status")`).
    """
    found: list[tuple[str, int]] = []

    def names_attribute(node: ast.AST) -> bool:
        """True when the expression reads `.approval_status` or the dict key of that name."""
        for inner in ast.walk(node):
            if isinstance(inner, ast.Attribute) and inner.attr == ATTRIBUTE:
                return True
            if isinstance(inner, ast.Subscript) and constant_text(inner.slice) == ATTRIBUTE:
                return True
            if (
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Attribute)
                and inner.func.attr == "get"
                and inner.args
                and constant_text(inner.args[0]) == ATTRIBUTE
            ):
                return True
        return False

    def is_hand_written(node: ast.AST) -> bool:
        """A comparison, a column filter, or `filter_by` that touches `approval_status`."""
        if isinstance(node, ast.Compare):
            return names_attribute(node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in FILTER_METHODS:
                return names_attribute(node.func.value)
            if node.func.attr == "filter_by":
                return any(keyword.arg == ATTRIBUTE for keyword in node.keywords)
        return False

    def visit(node: ast.AST, function: str) -> None:
        """Walk down, remembering the nearest enclosing function name."""
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            function = node.name
        if is_hand_written(node):
            found.append((function, getattr(node, "lineno", 0)))
        for child in ast.iter_child_nodes(node):
            visit(child, function)

    visit(parse(path), "<module>")
    return found


def constant_text(node: ast.AST) -> str | None:
    """The string a constant node holds, or None."""
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


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
        "def negated(query):\n    return query.where(Vendor.approval_status.notin_(['rejected']))\n"
        "def nulls(query):\n    return query.where(Vendor.approval_status.is_(None))\n"
        "def by_keyword(query):\n    return query.filter_by(approval_status='approved')\n"
        "def dict_row(row):\n    return row['approval_status'] == 'approved'\n"
        "def dict_get(row):\n    return row.get('approval_status') in ('approved',)\n"
        "def fine(vendor):\n    return vendor.status == 'x'\n"
        "def display(row):\n    return {'approval_status': row['approval_status']}\n",
        encoding="utf-8",
    )
    flagged = [function for function, _ in unlisted(planted)]
    assert flagged == ["listed", "many", "negated", "nulls", "by_keyword", "dict_row", "dict_get"]
