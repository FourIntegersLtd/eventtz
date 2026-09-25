"""Freeze: the blog CMS (staff) and the public blog feed.

Owned by the `content` slice. Every post is created with a per-run unique title,
so assertions never depend on what other posts exist in the database.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from supabase import Client

from conftest import API

POST_NOT_FOUND = "Post not found."
SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
# Event handlers, scripts and `javascript:` links that the CMS must strip on save.
UNSAFE_HTML = '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:bad()">link</a></p>'
# A syntactically valid UUID that no post will ever have.
MISSING_POST_ID = "00000000-0000-4000-8000-000000000000"
# Keys every list item carries, in the baseline's `BlogPostListItem` order.
LIST_ITEM_KEYS = {
    "id",
    "slug",
    "title",
    "subtitle",
    "cover_image_url",
    "excerpt",
    "author_name",
    "status",
    "published_at",
    "created_at",
    "updated_at",
}


def unique_title(label: str) -> str:
    """A post title no other run will reuse, e.g. `Acceptance draft 3f9a1c2b`."""
    return f"Acceptance {label} {secrets.token_hex(4)}"


def create_post(browser: httpx.Client, **body: Any) -> dict[str, Any]:
    """Create a draft through the admin API and return the `post` object."""
    response = browser.post(f"{API}/admin/blog/posts", json=body)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["success"] is True
    return dict(payload["post"])


@pytest.fixture
def draft_post(as_staff: httpx.Client, admin_db: Client) -> Iterator[dict[str, Any]]:
    """A fresh draft post, deleted from the database after the test."""
    post = create_post(as_staff, title=unique_title("draft"))
    yield post
    admin_db.table("blog_posts").delete().eq("id", post["id"]).execute()


def audit_actions(admin_db: Client, post_id: str) -> list[str]:
    """The `admin_audit_log.action` values recorded against one post, oldest first."""
    result = (
        admin_db.table("admin_audit_log")
        .select("action")
        .eq("entity_type", "blog_post")
        .eq("entity_id", post_id)
        .order("created_at")
        .execute()
    )
    return [str(entry["action"]) for entry in result.data]


# --- who may use the admin CMS -------------------------------------------------


def test_admin_blog_needs_a_session(anonymous: httpx.Client) -> None:
    response = anonymous.get(f"{API}/admin/blog/posts")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize("portal_fixture", ["as_client", "as_vendor"])
def test_admin_blog_refuses_clients_and_vendors(portal_fixture: str, request: pytest.FixtureRequest) -> None:
    browser: httpx.Client = request.getfixturevalue(portal_fixture)
    response = browser.get(f"{API}/admin/blog/posts")
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


# --- create ---------------------------------------------------------------------


def test_create_makes_an_empty_draft(as_staff: httpx.Client, staff_account: Any, admin_db: Client) -> None:
    title = unique_title("Create Me!")
    post = create_post(as_staff, title=f"  {title}  ", subtitle="  A subtitle  ", author_name="Ignored")
    try:
        assert post["title"] == title
        assert post["slug"] == title.lower().replace(" ", "-").replace("!", "")
        assert post["subtitle"] == "A subtitle"
        assert post["status"] == "draft"
        assert post["published_at"] is None
        assert post["body_json"] == {"type": "doc", "content": [{"type": "paragraph"}]}
        assert post["body_html"] == ""
        assert post["excerpt"] is None
        assert post["cover_image_url"] is None
        # BASELINE BUG: `author_name` in the create body is accepted but silently ignored.
        assert post["author_name"] is None
        assert post["author_admin_user_id"] == staff_account.user_id
        assert audit_actions(admin_db, post["id"]) == ["blog.create"]
    finally:
        admin_db.table("blog_posts").delete().eq("id", post["id"]).execute()


def test_create_with_no_body_uses_untitled(as_staff: httpx.Client, admin_db: Client) -> None:
    post = create_post(as_staff)
    try:
        assert post["title"] == "Untitled"
        assert post["slug"] == "untitled" or post["slug"].startswith("untitled-")
    finally:
        admin_db.table("blog_posts").delete().eq("id", post["id"]).execute()


def test_a_taken_slug_gets_a_numeric_suffix(as_staff: httpx.Client, admin_db: Client) -> None:
    title = unique_title("twin")
    first = create_post(as_staff, title=title)
    second = create_post(as_staff, title=title)
    third = create_post(as_staff, slug=first["slug"], title="Different title")
    try:
        assert second["slug"] == f"{first['slug']}-2"
        assert third["slug"] == f"{first['slug']}-3"
    finally:
        for post in (first, second, third):
            admin_db.table("blog_posts").delete().eq("id", post["id"]).execute()


def test_a_slug_with_no_letters_or_digits_becomes_post(as_staff: httpx.Client, admin_db: Client) -> None:
    post = create_post(as_staff, title="!!!", slug="***")
    try:
        assert post["slug"] == "post" or post["slug"].startswith("post-")
        assert post["title"] == "!!!"
    finally:
        admin_db.table("blog_posts").delete().eq("id", post["id"]).execute()


# --- read, update ---------------------------------------------------------------


def test_admin_get_returns_the_full_post(as_staff: httpx.Client, draft_post: dict[str, Any]) -> None:
    response = as_staff.get(f"{API}/admin/blog/posts/{draft_post['id']}")
    assert response.status_code == 200
    assert response.json() == {"success": True, "post": draft_post}


@pytest.mark.parametrize("post_id", [MISSING_POST_ID, "not-a-uuid"])
def test_admin_get_unknown_post_is_404(as_staff: httpx.Client, post_id: str) -> None:
    response = as_staff.get(f"{API}/admin/blog/posts/{post_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == POST_NOT_FOUND


def test_admin_list_includes_drafts_as_list_items(as_staff: httpx.Client, draft_post: dict[str, Any]) -> None:
    response = as_staff.get(f"{API}/admin/blog/posts")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    listed = {post["id"]: post for post in body["posts"]}
    assert draft_post["id"] in listed
    assert set(listed[draft_post["id"]]) == LIST_ITEM_KEYS
    # Most recently updated first: the draft we just made is at the top.
    assert body["posts"][0]["id"] == draft_post["id"]


def test_update_trims_blanks_and_sanitizes_html(
    as_staff: httpx.Client, draft_post: dict[str, Any], admin_db: Client
) -> None:
    new_slug = unique_title("Renamed Slug").lower().replace(" ", "-")
    body_json = {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hi"}]}],
    }
    response = as_staff.patch(
        f"{API}/admin/blog/posts/{draft_post['id']}",
        json={
            "title": "   ",
            "subtitle": "   ",
            "slug": f"  {new_slug}  ",
            "excerpt": "  Short intro  ",
            "cover_image_url": " https://cdn.example.com/cover.jpg ",
            "author_name": "  Jane Writer  ",
            "body_json": body_json,
            "body_html": UNSAFE_HTML,
        },
    )
    assert response.status_code == 200, response.text
    post = response.json()["post"]
    assert post["title"] == "Untitled"
    assert post["subtitle"] is None
    assert post["slug"] == new_slug
    assert post["excerpt"] == "Short intro"
    assert post["cover_image_url"] == "https://cdn.example.com/cover.jpg"
    assert post["author_name"] == "Jane Writer"
    assert post["body_json"] == body_json
    assert post["body_html"] == "<p>Hi alert(1)<a>link</a></p>"
    assert post["updated_at"] != draft_post["updated_at"]
    assert audit_actions(admin_db, draft_post["id"]) == ["blog.create", "blog.update"]


def test_update_keeping_its_own_slug_does_not_add_a_suffix(
    as_staff: httpx.Client, draft_post: dict[str, Any]
) -> None:
    response = as_staff.patch(f"{API}/admin/blog/posts/{draft_post['id']}", json={"slug": draft_post["slug"]})
    assert response.status_code == 200
    assert response.json()["post"]["slug"] == draft_post["slug"]


def test_update_unknown_post_is_404(as_staff: httpx.Client) -> None:
    response = as_staff.patch(f"{API}/admin/blog/posts/{MISSING_POST_ID}", json={"title": "Nope"})
    assert response.status_code == 404
    assert response.json()["detail"] == POST_NOT_FOUND


# --- publish lifecycle and the public feed ---------------------------------------


def test_publish_unpublish_and_the_public_feed(
    as_staff: httpx.Client, anonymous: httpx.Client, draft_post: dict[str, Any], admin_db: Client
) -> None:
    slug = draft_post["slug"]
    # A draft is invisible to the public.
    assert anonymous.get(f"{API}/blog/posts/{slug}").status_code == 404
    public_ids = [
        post["id"] for post in anonymous.get(f"{API}/blog/posts", params={"limit": 100}).json()["posts"]
    ]
    assert draft_post["id"] not in public_ids

    as_staff.patch(
        f"{API}/admin/blog/posts/{draft_post['id']}", json={"body_html": "<p>Hello <b>world</b></p>"}
    )
    published = as_staff.post(f"{API}/admin/blog/posts/{draft_post['id']}/publish")
    assert published.status_code == 200
    first_published_at = published.json()["post"]["published_at"]
    assert published.json()["post"]["status"] == "published"
    assert first_published_at

    detail = anonymous.get(f"{API}/blog/posts/{slug}")
    assert detail.status_code == 200
    public_post = detail.json()["post"]
    assert detail.json()["success"] is True
    assert set(public_post) == LIST_ITEM_KEYS | {"body_html"}
    assert public_post["body_html"] == "<p>Hello <b>world</b></p>"

    feed = anonymous.get(f"{API}/blog/posts", params={"limit": 100}).json()["posts"]
    assert feed[0]["id"] == draft_post["id"]  # newest `published_at` first
    assert all(post["status"] == "published" for post in feed)

    # Unpublish hides it again but keeps `published_at`; republishing keeps the first date.
    unpublished = as_staff.post(f"{API}/admin/blog/posts/{draft_post['id']}/unpublish").json()["post"]
    assert unpublished["status"] == "draft"
    assert unpublished["published_at"] == first_published_at
    assert anonymous.get(f"{API}/blog/posts/{slug}").status_code == 404
    republished = as_staff.post(f"{API}/admin/blog/posts/{draft_post['id']}/publish").json()["post"]
    assert republished["published_at"] == first_published_at

    assert audit_actions(admin_db, draft_post["id"]) == [
        "blog.create",
        "blog.update",
        "blog.publish",
        "blog.unpublish",
        "blog.publish",
    ]


@pytest.mark.parametrize("action", ["publish", "unpublish"])
def test_publishing_an_unknown_post_is_404(as_staff: httpx.Client, action: str) -> None:
    response = as_staff.post(f"{API}/admin/blog/posts/{MISSING_POST_ID}/{action}")
    assert response.status_code == 404
    assert response.json()["detail"] == POST_NOT_FOUND


def test_public_post_unknown_slug_is_404(anonymous: httpx.Client) -> None:
    response = anonymous.get(f"{API}/blog/posts/no-such-post-{secrets.token_hex(4)}")
    assert response.status_code == 404
    assert response.json()["detail"] == POST_NOT_FOUND


@pytest.mark.parametrize("limit", [0, 101])
def test_public_feed_limit_is_bounded(anonymous: httpx.Client, limit: int) -> None:
    assert anonymous.get(f"{API}/blog/posts", params={"limit": limit}).status_code == 422


# --- delete ------------------------------------------------------------------------


def test_delete_removes_the_post(as_staff: httpx.Client, admin_db: Client) -> None:
    post = create_post(as_staff, title=unique_title("delete"))
    response = as_staff.delete(f"{API}/admin/blog/posts/{post['id']}")
    assert response.status_code == 200
    assert response.json() == {"success": True}
    assert as_staff.get(f"{API}/admin/blog/posts/{post['id']}").status_code == 404
    assert audit_actions(admin_db, post["id"]) == ["blog.create", "blog.delete"]


def test_delete_unknown_post_is_404(as_staff: httpx.Client) -> None:
    response = as_staff.delete(f"{API}/admin/blog/posts/{MISSING_POST_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == POST_NOT_FOUND
