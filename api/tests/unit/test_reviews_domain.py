"""Reviews domain rules with no I/O: reviewer display names and photo URL filtering."""

from __future__ import annotations

from app.features.reviews.domain import (
    ANONYMOUS_REVIEWER,
    normalized_review_image_urls,
    reviewer_display_from_email,
)


def test_reviewer_display_capitalises_and_clips_the_local_part() -> None:
    assert reviewer_display_from_email("jonathansmith@example.com") == "Jonathansmith"


def test_reviewer_display_clips_at_eighteen_characters() -> None:
    assert reviewer_display_from_email("abcdefghijklmnopqrstuvwxyz@example.com") == "Abcdefghijklmnopqr"


def test_reviewer_display_strips_punctuation_the_baseline_regex_removes() -> None:
    assert reviewer_display_from_email("jo+ann!!@example.com") == "Joann"


def test_reviewer_display_uppercases_a_single_character_local_part() -> None:
    assert reviewer_display_from_email("a@example.com") == "A"


def test_reviewer_display_falls_back_for_a_missing_email() -> None:
    assert reviewer_display_from_email(None) == ANONYMOUS_REVIEWER


def test_reviewer_display_falls_back_when_stripping_leaves_nothing() -> None:
    assert reviewer_display_from_email("!!!@example.com") == ANONYMOUS_REVIEWER


def test_image_urls_keep_only_http_and_https() -> None:
    urls = ["ftp://example.com/a.png", "https://example.com/b.png", "http://example.com/c.png"]
    assert normalized_review_image_urls(urls) == ["https://example.com/b.png", "http://example.com/c.png"]


def test_image_urls_drop_duplicates() -> None:
    urls = ["https://example.com/a.png", "https://example.com/a.png"]
    assert normalized_review_image_urls(urls) == ["https://example.com/a.png"]


def test_image_urls_cap_at_five() -> None:
    urls = [f"https://example.com/{photo_number}.png" for photo_number in range(8)]
    expected = [f"https://example.com/{photo_number}.png" for photo_number in range(5)]
    assert normalized_review_image_urls(urls) == expected


def test_image_urls_reads_a_non_list_as_empty() -> None:
    assert normalized_review_image_urls(None) == []
    assert normalized_review_image_urls("https://example.com/a.png") == []
