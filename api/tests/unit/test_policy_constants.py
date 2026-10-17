"""`web/lib/policyConstants.json` (printed in the Terms) must equal what the API enforces.

If someone edits a number in the legal copy without the code, or the code without the copy,
this fails. Keys with no API counterpart are listed in `COPY_ONLY_KEYS`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.settings import Settings
from app.features.bookings import domain_cancellation, domain_policy
from app.features.vendors import domain_profile_form

POLICY_FILE = Path(__file__).resolve().parents[3] / "web" / "lib" / "policyConstants.json"

# Printed in the Terms but not enforced by any API constant (promises about staff handling,
# notice periods and legal limits), so there is nothing to compare them with.
COPY_ONLY_KEYS = frozenset(
    {
        "previousTermsVersion",
        "vendorTermsChangeNoticeDays",
        "vendorTerminationNoticeDays",
        "complaintAcknowledgeWorkingDays",
        "complaintReplyDays",
        "circumventionMonths",
        "liabilityCapMinimumGbp",
        "liabilityCapMonthsOfFees",
        "claimsTimeLimitMonths",
        "unclaimedVendorShareMonths",
        "minimumAge",
    }
)


@pytest.fixture(scope="module")
def policy() -> dict[str, Any]:
    """The shared constants file, as the web app reads it."""
    return json.loads(POLICY_FILE.read_text())


def _default(setting_name: str) -> Any:
    """A setting's default value (what runs when no environment variable overrides it)."""
    return Settings.model_fields[setting_name].default


def test_every_key_in_the_file_is_either_checked_here_or_listed_as_copy_only(policy: dict[str, Any]) -> None:
    checked_keys = {
        "termsVersion",
        "cancellationPresets",
        "coolingOffHours",
        "coolingOffMinDaysBeforeEvent",
        "paymentDeadlineHours",
        "paymentDeadlineHoursBeforeEvent",
        "reportWindowHoursDefault",
        "reportWindowHoursByCategory",
        "deliverySplitCategories",
        "deliveryUpfrontPercentMin",
        "deliveryUpfrontPercentMax",
        "deliveryDeadlineDaysMax",
        "depositCategories",
        "depositMaxGbp",
        "depositClaimDays",
        "vendorCancellationReviewCount",
        "vendorCancellationReviewDays",
    }

    assert set(policy) == checked_keys | COPY_ONLY_KEYS


def test_terms_version_and_deadlines_equal_the_settings_defaults(policy: dict[str, Any]) -> None:
    assert policy["termsVersion"] == _default("terms_version") == "2026-11-01"
    assert policy["paymentDeadlineHours"] == _default("booking_payment_deadline_hours") == 72
    assert (
        policy["paymentDeadlineHoursBeforeEvent"] == domain_policy.PAYMENT_DEADLINE_HOURS_BEFORE_EVENT == 48
    )
    assert (
        policy["reportWindowHoursDefault"] == _default("booking_payout_auto_release_hours_after_event") == 48
    )


def test_report_windows_split_and_deposit_equal_the_domain_policy_constants(policy: dict[str, Any]) -> None:
    assert policy["reportWindowHoursByCategory"] == domain_policy.REPORT_WINDOW_HOURS_BY_CATEGORY
    assert set(policy["deliverySplitCategories"]) == domain_policy.DELIVERY_SPLIT_CATEGORIES
    assert policy["deliveryUpfrontPercentMin"] == domain_policy.DELIVERY_UPFRONT_PERCENT_MIN
    assert policy["deliveryUpfrontPercentMax"] == domain_policy.DELIVERY_UPFRONT_PERCENT_MAX
    assert policy["deliveryDeadlineDaysMax"] == domain_policy.DELIVERY_DEADLINE_DAYS_MAX
    assert set(policy["depositCategories"]) == domain_policy.DEPOSIT_CATEGORIES
    assert policy["depositMaxGbp"] == domain_policy.DEPOSIT_MAX_GBP
    assert policy["depositClaimDays"] == domain_policy.DEPOSIT_CLAIM_DAYS
    assert policy["vendorCancellationReviewCount"] == domain_policy.VENDOR_CANCELLATION_REVIEW_COUNT
    assert policy["vendorCancellationReviewDays"] == domain_policy.VENDOR_CANCELLATION_REVIEW_DAYS


def test_cancellation_presets_and_cooling_off_equal_domain_cancellation(policy: dict[str, Any]) -> None:
    file_presets = {
        name: [list(tier) for tier in tiers] for name, tiers in policy["cancellationPresets"].items()
    }
    code_presets = {
        name: [list(tier) for tier in tiers] for name, tiers in domain_cancellation.PRESET_TIERS.items()
    }

    assert file_presets == code_presets
    assert policy["coolingOffHours"] == domain_cancellation.COOLING_OFF_HOURS
    assert policy["coolingOffMinDaysBeforeEvent"] == domain_cancellation.COOLING_OFF_MIN_DAYS_BEFORE_EVENT


def test_the_vendor_profile_limits_equal_the_file_and_the_booking_rules(policy: dict[str, Any]) -> None:
    assert policy["deliveryUpfrontPercentMin"] == domain_profile_form.DELIVERY_UPFRONT_PERCENT_MIN
    assert policy["deliveryUpfrontPercentMax"] == domain_profile_form.DELIVERY_UPFRONT_PERCENT_MAX
    assert policy["deliveryDeadlineDaysMax"] == domain_profile_form.DELIVERY_DEADLINE_DAYS_MAX
    assert policy["depositMaxGbp"] == domain_profile_form.DEPOSIT_MAX_GBP
