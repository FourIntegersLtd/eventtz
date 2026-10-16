"""Freeze: the signed-in Help Center (categories, articles, the AI assistant).

Owned by the `content` slice. The module seeds its own categories and articles
with per-run unique slugs, so assertions never depend on the migration seed data.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import httpx
import pytest
from support.database import LocalDatabase

from conftest import API

SIGN_IN_REQUIRED = "Please sign in to continue."
AUDIENCE_MISMATCH = "Audience must match your account type."
ARTICLE_NOT_FOUND = "Article not found."
QUESTION_REQUIRED = "Question is required."
# OpenAI is switched off for the suite, so the assistant refuses with the shared AI copy.
OPENAI_UNAVAILABLE = "This AI feature isn't available right now. Please try again later."
CATEGORY_KEYS = {"id", "slug", "title", "description", "icon_key", "sort_order", "audience", "article_count"}
ARTICLE_LIST_KEYS = {
    "id",
    "slug",
    "title",
    "summary",
    "audience",
    "category_id",
    "category_slug",
    "category_title",
    "sort_order",
}
ARTICLE_DETAIL_KEYS = ARTICLE_LIST_KEYS | {"body_md", "related_slugs", "related_articles"}


@dataclass(frozen=True)
class HelpSeed:
    """Slugs of the categories and articles this module created, keyed by audience."""

    category_slugs: dict[str, str]
    article_slugs: dict[str, str]
    unpublished_article_slug: str


def _slug(label: str, run_token: str) -> str:
    """A slug unique to this run, e.g. `acceptance-client-1a2b3c4d`."""
    return f"acceptance-{label}-{run_token}"


@pytest.fixture(scope="module")
def help_seed(admin_db: LocalDatabase) -> Iterator[HelpSeed]:
    """One category per audience, one article in each, plus a `both` and an unpublished article.

    The `both` article lives in the client category so client and vendor both
    count it; the unpublished article must never be counted or served.
    """
    run_token = secrets.token_hex(4)
    category_slugs = {
        audience: _slug(f"{audience}-cat", run_token) for audience in ("client", "vendor", "admin")
    }
    category_ids: dict[str, str] = {}
    for audience, category_slug in category_slugs.items():
        inserted = (
            admin_db.table("help_categories")
            .insert(
                {
                    "slug": category_slug,
                    "title": f"Acceptance {audience} category",
                    "description": f"Seeded for {audience}",
                    "icon_key": "book",
                    "sort_order": 999,
                    "audience": audience,
                }
            )
            .execute()
        )
        category_ids[audience] = str(inserted.data[0]["id"])

    article_slugs = {
        audience: _slug(f"{audience}-article", run_token) for audience in ("client", "vendor", "admin")
    }
    article_slugs["both"] = _slug("both-article", run_token)
    unpublished_slug = _slug("unpublished-article", run_token)
    missing_related_slug = _slug("missing-related", run_token)
    article_rows: list[dict[str, Any]] = [
        {
            "category_id": category_ids[audience],
            "slug": article_slugs[audience],
            "title": f"Acceptance {audience} article",
            "summary": f"How {audience}s do things",
            "body_md": f"# {audience}\n\nBody.",
            "audience": audience,
            "sort_order": 1,
            "related_slugs": [],
        }
        for audience in ("client", "vendor", "admin")
    ]
    # The client article links to the `both` article and to a slug that does not exist.
    article_rows[0]["related_slugs"] = [article_slugs["both"], missing_related_slug]
    article_rows.append(
        {
            "category_id": category_ids["client"],
            "slug": article_slugs["both"],
            "title": "Acceptance shared article",
            "summary": "For everyone",
            "body_md": "Shared.",
            "audience": "both",
            "sort_order": 2,
            "related_slugs": [],
        }
    )
    admin_db.table("help_articles").insert(article_rows).execute()
    # Inserted on its own: a bulk insert needs every row to carry the same keys.
    admin_db.table("help_articles").insert(
        {
            "category_id": category_ids["client"],
            "slug": unpublished_slug,
            "title": "Acceptance hidden article",
            "audience": "client",
            "published": False,
        }
    ).execute()
    yield HelpSeed(category_slugs, article_slugs, unpublished_slug)
    # Articles go with their categories (ON DELETE CASCADE).
    admin_db.table("help_categories").delete().in_("id", list(category_ids.values())).execute()


def categories_by_slug(browser: httpx.Client, **params: str) -> dict[str, dict[str, Any]]:
    """GET /help/categories and index the result by slug."""
    response = browser.get(f"{API}/help/categories", params=params)
    assert response.status_code == 200, response.text
    return {category["slug"]: category for category in response.json()["categories"]}


def article_slugs_listed(browser: httpx.Client, **params: str) -> list[str]:
    """GET /help/articles and return the slugs in response order."""
    response = browser.get(f"{API}/help/articles", params=params)
    assert response.status_code == 200, response.text
    return [article["slug"] for article in response.json()["articles"]]


# --- who may read help -------------------------------------------------------------


@pytest.mark.parametrize("path", ["/help/categories", "/help/articles", "/help/articles/anything"])
def test_help_needs_a_session(anonymous: httpx.Client, path: str) -> None:
    response = anonymous.get(f"{API}{path}")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize(
    ("portal_fixture", "other_audience"),
    [("as_client", "vendor"), ("as_client", "admin"), ("as_vendor", "client")],
)
def test_portal_users_cannot_read_another_audience(
    portal_fixture: str, other_audience: str, request: pytest.FixtureRequest
) -> None:
    browser: httpx.Client = request.getfixturevalue(portal_fixture)
    for path in ("/help/categories", "/help/articles"):
        response = browser.get(f"{API}{path}", params={"audience": other_audience})
        assert response.status_code == 403
        assert response.json()["detail"] == AUDIENCE_MISMATCH


# --- categories ----------------------------------------------------------------------


def test_client_sees_client_categories_with_published_counts(
    as_client: httpx.Client, help_seed: HelpSeed
) -> None:
    categories = categories_by_slug(as_client)
    client_category = categories[help_seed.category_slugs["client"]]
    assert set(client_category) == CATEGORY_KEYS
    assert client_category["audience"] == "client"
    assert client_category["title"] == "Acceptance client category"
    assert client_category["description"] == "Seeded for client"
    assert client_category["sort_order"] == 999
    # The client article and the `both` article; the unpublished one is not counted.
    assert client_category["article_count"] == 2
    assert help_seed.category_slugs["vendor"] not in categories
    assert help_seed.category_slugs["admin"] not in categories
    assert categories == categories_by_slug(as_client, audience="client")


def test_vendor_counts_shared_articles_in_its_own_categories(
    as_vendor: httpx.Client, help_seed: HelpSeed
) -> None:
    categories = categories_by_slug(as_vendor)
    assert categories[help_seed.category_slugs["vendor"]]["article_count"] == 1
    assert help_seed.category_slugs["client"] not in categories


def test_staff_default_to_admin_docs_only(as_staff: httpx.Client, help_seed: HelpSeed) -> None:
    categories = categories_by_slug(as_staff)
    assert help_seed.category_slugs["admin"] in categories
    assert help_seed.category_slugs["client"] not in categories
    # An unknown audience falls back to admin docs for staff.
    assert categories_by_slug(as_staff, audience="nonsense") == categories


def test_staff_may_preview_client_docs(as_staff: httpx.Client, help_seed: HelpSeed) -> None:
    categories = categories_by_slug(as_staff, audience="client")
    assert categories[help_seed.category_slugs["client"]]["article_count"] == 2
    assert help_seed.category_slugs["admin"] not in categories


# --- article lists ---------------------------------------------------------------------


def test_client_article_list_is_published_client_and_shared(
    as_client: httpx.Client, help_seed: HelpSeed
) -> None:
    listed = article_slugs_listed(as_client)
    assert help_seed.article_slugs["client"] in listed
    assert help_seed.article_slugs["both"] in listed
    assert help_seed.article_slugs["vendor"] not in listed
    assert help_seed.article_slugs["admin"] not in listed
    assert help_seed.unpublished_article_slug not in listed


def test_admin_article_list_excludes_shared_articles(as_staff: httpx.Client, help_seed: HelpSeed) -> None:
    listed = article_slugs_listed(as_staff)
    assert help_seed.article_slugs["admin"] in listed
    assert help_seed.article_slugs["both"] not in listed


def test_article_list_filtered_by_category(as_client: httpx.Client, help_seed: HelpSeed) -> None:
    category_slug = help_seed.category_slugs["client"]
    response = as_client.get(f"{API}/help/articles", params={"category": category_slug})
    articles = response.json()["articles"]
    # Ordered by `sort_order`: the client article (1) before the shared one (2).
    assert [article["slug"] for article in articles] == [
        help_seed.article_slugs["client"],
        help_seed.article_slugs["both"],
    ]
    assert set(articles[0]) == ARTICLE_LIST_KEYS
    assert articles[0]["category_slug"] == category_slug
    assert articles[0]["category_title"] == "Acceptance client category"
    assert articles[0]["summary"] == "How clients do things"


def test_article_list_for_an_unknown_category_is_empty(as_client: httpx.Client) -> None:
    assert article_slugs_listed(as_client, category=f"no-such-category-{secrets.token_hex(4)}") == []


# --- article detail -----------------------------------------------------------------------


def test_article_detail_resolves_related_titles(as_client: httpx.Client, help_seed: HelpSeed) -> None:
    response = as_client.get(f"{API}/help/articles/{help_seed.article_slugs['client']}")
    assert response.status_code == 200
    article = response.json()["article"]
    assert set(article) == ARTICLE_DETAIL_KEYS
    assert article["body_md"] == "# client\n\nBody."
    assert article["category_slug"] == help_seed.category_slugs["client"]
    missing_related_slug = article["related_slugs"][1]
    assert article["related_slugs"] == [help_seed.article_slugs["both"], missing_related_slug]
    # A related slug that does not exist keeps its slug as the title.
    assert article["related_articles"] == [
        {"slug": help_seed.article_slugs["both"], "title": "Acceptance shared article"},
        {"slug": missing_related_slug, "title": missing_related_slug},
    ]


def test_article_detail_hides_other_audiences_and_unpublished(
    as_client: httpx.Client, help_seed: HelpSeed
) -> None:
    for slug in (help_seed.article_slugs["vendor"], help_seed.unpublished_article_slug):
        response = as_client.get(f"{API}/help/articles/{slug}")
        assert response.status_code == 404
        assert response.json()["detail"] == ARTICLE_NOT_FOUND


# --- the assistant ------------------------------------------------------------------------------


def test_ask_rejects_a_blank_question(as_client: httpx.Client) -> None:
    response = as_client.post(f"{API}/help/ask", json={"question": "   ", "audience": "client"})
    assert response.status_code == 400
    assert response.json()["detail"] == QUESTION_REQUIRED


def test_ask_rejects_an_empty_question_at_validation(as_client: httpx.Client) -> None:
    response = as_client.post(f"{API}/help/ask", json={"question": "", "audience": "client"})
    assert response.status_code == 422


def test_ask_checks_the_audience_first(as_client: httpx.Client) -> None:
    response = as_client.post(f"{API}/help/ask", json={"question": "   ", "audience": "vendor"})
    assert response.status_code == 403
    assert response.json()["detail"] == AUDIENCE_MISMATCH


def test_ask_without_a_language_model_is_503(as_client: httpx.Client) -> None:
    response = as_client.post(f"{API}/help/ask", json={"question": "How do I pay?", "audience": "client"})
    assert response.status_code == 503
    assert response.json()["detail"] == OPENAI_UNAVAILABLE


def test_ask_needs_a_session(anonymous: httpx.Client) -> None:
    response = anonymous.post(f"{API}/help/ask", json={"question": "Hi", "audience": "client"})
    assert response.status_code == 401
