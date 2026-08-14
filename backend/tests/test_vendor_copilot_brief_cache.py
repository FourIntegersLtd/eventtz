"""Vendor co-pilot brief fingerprint and narration cache tests."""

from app.features.vendor_copilot.brief_cache import (
    BriefNarrationCacheEntry,
    clear_narration_cache_for_tests,
    compute_brief_fingerprint,
    get_or_compute_narration,
    narration_cache_get,
)


def _sample_ctx(*, pending_ids: list[str] | None = None, growth_score: int = 42) -> dict:
    pending = [{"id": pid, "event_name": "Test event"} for pid in (pending_ids or [])]
    return {
        "growth_score": growth_score,
        "growth_levers": [
            {"key": "listing", "score": 50, "status": "ok", "tip": "Add photos"},
        ],
        "listing_visible": True,
        "payouts_verified": True,
        "approval_status": "approved",
        "pending_bookings": pending,
        "analytics_overview": {
            "pending_enquiries": len(pending),
            "expired_enquiries": 0,
            "enquiries": 3,
            "profile_views": 10,
            "review_count": 1,
            "avg_response_seconds": 3600.7,
            "conversion_rate": 0.333333,
        },
        "payload_summary": {"package_count": 2, "has_bio": True, "has_profile_image": True},
        "profile_updated_at": "2026-08-14T12:00:00Z",
        "business_name": "Test Catering",
    }


def test_fingerprint_stable_for_same_context():
    ctx = _sample_ctx(pending_ids=["b1"])
    assert compute_brief_fingerprint(ctx) == compute_brief_fingerprint(ctx)


def test_fingerprint_changes_when_pending_changes():
    a = compute_brief_fingerprint(_sample_ctx(pending_ids=["b1"]))
    b = compute_brief_fingerprint(_sample_ctx(pending_ids=["b2"]))
    assert a != b


def test_narration_cache_hit_on_same_fingerprint():
    clear_narration_cache_for_tests()
    ctx = _sample_ctx(pending_ids=["b1"])
    fp = compute_brief_fingerprint(ctx)
    calls = {"n": 0}

    def compute() -> BriefNarrationCacheEntry:
        calls["n"] += 1
        return BriefNarrationCacheEntry(greeting="Hi", summary_markdown="Summary")

    first, cached1 = get_or_compute_narration("vendor-1", fp, compute)
    second, cached2 = get_or_compute_narration("vendor-1", fp, compute)

    assert calls["n"] == 1
    assert cached1 is False
    assert cached2 is True
    assert first.greeting == second.greeting
    assert narration_cache_get("vendor-1", fp) is not None


def test_narration_cache_miss_when_fingerprint_changes():
    clear_narration_cache_for_tests()
    fp_a = compute_brief_fingerprint(_sample_ctx(pending_ids=["b1"]))
    fp_b = compute_brief_fingerprint(_sample_ctx(pending_ids=["b2"]))
    calls = {"n": 0}

    def compute() -> BriefNarrationCacheEntry:
        calls["n"] += 1
        return BriefNarrationCacheEntry(greeting=f"Hi {calls['n']}", summary_markdown="Summary")

    get_or_compute_narration("vendor-1", fp_a, compute)
    _, cached = get_or_compute_narration("vendor-1", fp_b, compute)

    assert calls["n"] == 2
    assert cached is False
