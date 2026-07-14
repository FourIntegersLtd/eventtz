"""Blog CMS service tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.features.blog.sanitize import sanitize_blog_html
from app.features.blog import service as blog_service


@pytest.fixture(autouse=True)
def _clear_local():
    blog_service.clear_local_posts_for_tests()
    yield
    blog_service.clear_local_posts_for_tests()


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


@patch("app.features.blog.service.get_settings")
def test_create_publish_public_visibility(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    draft = blog_service.create_draft_post(
        author_admin_user_id="admin-1",
        title="Hello World",
    )
    assert draft["status"] == "draft"
    assert draft["slug"] == "hello-world"
    assert blog_service.list_published_posts() == []

    published = blog_service.publish_post(draft["id"])
    assert published["status"] == "published"
    public = blog_service.get_published_post_by_slug("hello-world")
    assert public is not None
    assert public["title"] == "Hello World"
    assert public.get("author_name") is None

    blog_service.update_post(draft["id"], {"author_name": "Eventtz Team"})
    public = blog_service.get_published_post_by_slug("hello-world")
    assert public is not None
    assert public["author_name"] == "Eventtz Team"

    blog_service.unpublish_post(draft["id"])
    assert blog_service.get_published_post_by_slug("hello-world") is None


@patch("app.features.blog.service.get_settings")
def test_slug_uniqueness(mock_settings):
    mock_settings.return_value.local_auth_mode = True
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
