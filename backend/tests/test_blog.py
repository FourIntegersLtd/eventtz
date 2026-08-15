"""Blog CMS service tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.features.blog.sanitize import sanitize_blog_html
from app.features.blog import service as blog_service


def test_sanitize_strips_scripts():
    html = sanitize_blog_html('<p>Hi</p><script>alert(1)</script><a href="javascript:x">x</a>')
    assert "<script>" not in html
    assert "javascript:" not in html
    assert "Hi" in html


def test_sanitize_keeps_safe_content():
    html = sanitize_blog_html(
        '<h2>Title</h2><p>Hello <strong>world</strong></p>'
        '<img src="https://cdn.example/a.jpg" alt="a" />'
        '<a href="https://eventtz.com" target="_blank">link</a>',
    )
    assert "<h2>" in html
    assert "https://cdn.example/a.jpg" in html
    assert 'rel="noopener noreferrer"' in html


def test_sanitize_keeps_figure_with_caption_and_order():
    html = sanitize_blog_html(
        '<p>Before</p>'
        '<figure class="blog-figure">'
        '<img src="https://cdn.example/one.jpg" alt="One" loading="lazy" />'
        '<figcaption>First photo</figcaption>'
        '</figure>'
        '<p>Between</p>'
        '<img src="https://cdn.example/two.jpg" alt="Two" />',
    )
    assert html.index("Before") < html.index("one.jpg") < html.index("Between") < html.index("two.jpg")
    assert "<figure" in html
    assert "<figcaption>" in html
    assert "First photo" in html
    assert 'class="blog-figure"' in html


def _mock_db_chain(client: MagicMock) -> MagicMock:
    table = MagicMock()
    client.table.return_value = table
    return table


@patch("app.features.blog.service.get_db")
def test_create_publish_public_visibility(mock_get_db):
    client = MagicMock()
    mock_get_db.return_value = client
    table = _mock_db_chain(client)

    draft_id = "post-1"
    table.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": draft_id,
            "slug": "hello-world",
            "title": "Hello World",
            "status": "draft",
            "subtitle": None,
            "cover_image_url": None,
            "excerpt": None,
            "author_name": None,
            "published_at": None,
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
            "body_json": {"type": "doc", "content": []},
            "body_html": "",
            "author_admin_user_id": "admin-1",
        }],
    )
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{
            "id": draft_id,
            "slug": "hello-world",
            "title": "Hello World",
            "status": "draft",
            "subtitle": None,
            "cover_image_url": None,
            "excerpt": None,
            "author_name": None,
            "published_at": None,
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
            "body_json": {"type": "doc", "content": []},
            "body_html": "",
            "author_admin_user_id": "admin-1",
        }],
    )
    table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    draft = blog_service.create_draft_post(
        author_admin_user_id="admin-1",
        title="Hello World",
    )
    assert draft["status"] == "draft"
    assert draft["slug"] == "hello-world"

    published_row = {**draft, "status": "published", "published_at": "2026-01-02T00:00:00+00:00"}
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[published_row],
    )
    published = blog_service.publish_post(draft["id"])
    assert published["status"] == "published"

    public_row = {**published_row, "body_html": "<p>Hi</p>"}
    table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[public_row],
    )
    public = blog_service.get_published_post_by_slug("hello-world")
    assert public is not None
    assert public["title"] == "Hello World"


@patch("app.features.blog.service.get_db")
def test_slug_uniqueness(mock_get_db):
    client = MagicMock()
    mock_get_db.return_value = client
    table = _mock_db_chain(client)

    def _insert_row(slug: str, post_id: str) -> MagicMock:
        return MagicMock(
            data=[{
                "id": post_id,
                "slug": slug,
                "title": "Same",
                "status": "draft",
                "subtitle": None,
                "cover_image_url": None,
                "excerpt": None,
                "author_name": None,
                "published_at": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
                "body_json": {"type": "doc", "content": []},
                "body_html": "",
                "author_admin_user_id": "a",
            }],
        )

    table.insert.return_value.execute.side_effect = [
        _insert_row("same", "p1"),
        _insert_row("same-2", "p2"),
    ]
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

    a = blog_service.create_draft_post(author_admin_user_id="a", title="Same")
    b = blog_service.create_draft_post(author_admin_user_id="a", title="Same")
    assert a["slug"] == "same"
    assert b["slug"] == "same-2"


@patch("app.features.blog.http.admin.require_admin", side_effect=HTTPException(status_code=403, detail="no"))
def test_admin_create_requires_admin(_mock):
    from fastapi import Response
    from starlette.requests import Request

    from app.contracts.blog import BlogPostCreateBody
    from app.features.blog.http.admin import admin_create_blog_post

    scope = {"type": "http", "method": "POST", "path": "/", "headers": []}
    with pytest.raises(HTTPException) as exc:
        admin_create_blog_post(Request(scope), Response(), BlogPostCreateBody(title="x"))
    assert exc.value.status_code == 403
