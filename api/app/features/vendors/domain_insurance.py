"""Public liability insurance: what a staff-checked certificate means. Pure.

Vendors may upload a certificate on the onboarding form (`payload.indemnityCertNamePersisted`).
Staff read it and record its expiry date and cover amount (`vendors.insurance_*`); the
vendor can never write those columns, so a vendor cannot vouch for their own cover.

Cover is optional for every service for now: a checked, in-date certificate earns the
"insurance checked" badge, and nothing blocks submitting, approval or the listing.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

# The least cover staff accept: £1m is what UK venues usually ask of a supplier.
MIN_COVER_GBP = 1_000_000
# Checked cover reads as "expiring" this long before it ends, so staff can ask for a renewal.
EXPIRING_WITHIN = timedelta(days=30)

InsuranceStatus = Literal["missing", "awaiting_check", "verified", "expiring", "expired"]


def insurance_status(
    *,
    certificate_url: str | None,
    verified_certificate_url: str | None,
    expires_on: date | None,
    today: date,
) -> InsuranceStatus:
    """Where the vendor's cover stands, for staff.

    A certificate on file that is not the one staff checked (a first upload or a
    renewal) reads `awaiting_check`, even while the older checked cover still runs.
    """
    if certificate_url and certificate_url != verified_certificate_url:
        return "awaiting_check"
    if expires_on is None:
        return "missing"
    if expires_on < today:
        return "expired"
    if expires_on - today <= EXPIRING_WITHIN:
        return "expiring"
    return "verified"


def has_valid_insurance(expires_on: date | None, *, today: date) -> bool:
    """True when staff checked cover that has not ended yet (what the badge shows)."""
    return expires_on is not None and expires_on >= today
