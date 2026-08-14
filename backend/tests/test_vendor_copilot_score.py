"""Growth Score unit tests."""

from app.features.vendor_copilot.score import compute_growth_score


def test_growth_score_new_vendor_baseline():
    payload = {
        "servicesOffered": ["catering"],
        "packages": [],
        "availableWeekdays": ["mon", "tue", "wed", "thu", "fri"],
        "maxBookingsPerDay": 2,
    }
    result = compute_growth_score(
        payload=payload,
        listing_visible=False,
        payouts_verified=False,
        analytics_overview={},
    )
    assert 0 <= result["score"] <= 100
    assert len(result["levers"]) == 5
    keys = {lev["key"] for lev in result["levers"]}
    assert keys == {"listing", "response", "conversion", "reviews", "availability"}


def test_growth_score_strong_listing():
    payload = {
        "businessName": "Test Catering",
        "servicesOffered": ["catering"],
        "profileImageUrl": "https://example.com/p.jpg",
        "aiBioDraft": "We cater weddings and birthdays across London with halal options.",
        "packages": [
            {
                "title": "Small Chops Pack",
                "price": "500",
                "details": "Assorted small chops for up to 50 guests, delivery included.",
                "duration": "4 hours",
            }
        ],
        "portfolioFileNames": ["a.jpg", "b.jpg", "c.jpg"],
        "availableWeekdays": ["mon", "tue", "wed", "thu", "fri", "sat"],
        "maxBookingsPerDay": 3,
    }
    overview = {
        "enquiries": 10,
        "conversion_rate": 0.4,
        "avg_response_seconds": 1800,
        "avg_customer_rating": 4.8,
        "review_count": 5,
        "profile_views": 40,
        "pending_enquiries": 0,
        "expired_enquiries": 0,
    }
    result = compute_growth_score(
        payload=payload,
        listing_visible=True,
        payouts_verified=True,
        analytics_overview=overview,
    )
    assert result["score"] >= 70
    listing = next(lev for lev in result["levers"] if lev["key"] == "listing")
    assert listing["status"] == "good"
