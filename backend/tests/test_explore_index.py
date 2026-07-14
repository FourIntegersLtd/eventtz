"""Explore index denormalization."""

from app.features.vendors.explore_index import explore_search_patch_from_payload


def test_explore_search_patch_includes_country_and_currency():
    patch = explore_search_patch_from_payload(
        {
            "countryCode": "GB",
            "baseCity": "London",
            "servicesOffered": ["catering"],
            "hourlyRate": "50",
        },
    )
    assert patch["country_code"] == "GB"
    assert patch["currency"] == "GBP"
    assert patch["base_city_normalized"] == "london"
    assert patch["min_list_price_gbp"] is not None


def test_explore_search_patch_defaults_country():
    patch = explore_search_patch_from_payload({"baseCity": "Leeds"})
    assert patch["country_code"] == "GB"
    assert patch["currency"] == "GBP"
