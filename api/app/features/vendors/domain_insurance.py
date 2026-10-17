"""Public liability insurance for higher-risk vendors: who needs it, what a checked certificate allows. Pure.

Vendors upload a certificate on the onboarding form (`payload.indemnityCertNamePersisted`).
Staff read it and record its expiry date and cover amount (`vendors.insurance_*`); the
vendor can never write those columns, so a vendor cannot vouch for their own cover.

For the services in `INSURANCE_REQUIRED_SERVICES` the cover is required:
- submitting the profile needs a certificate uploaded;
- staff cannot approve the vendor until they have checked an in-date certificate;
- once the checked cover has ended, the listing stays up for `EXPIRY_GRACE` and then
  hides itself until staff check a renewal (like a pause, it needs no job to take effect);
- vendors approved before the rule existed keep their listing until `INSURANCE_REQUIRED_FROM`.

For everyone else the certificate stays optional, and a checked one still earns the badge.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta
from typing import Literal

# Food: the services most likely to hurt a guest (allergens, food poisoning), and where venues
# already ask for a certificate. Other categories can be added here once their vendors hold cover.
INSURANCE_REQUIRED_SERVICES: frozenset[str] = frozenset({"catering", "baking"})
# The least cover staff accept: £1m is what UK venues usually ask of a supplier.
MIN_COVER_GBP = 1_000_000
# Vendors approved before the rule keep their listing until this day without a checked certificate.
INSURANCE_REQUIRED_FROM = date(2026, 12, 1)
# How long a listing stays up after the checked cover ends, so a renewal can be uploaded and checked.
EXPIRY_GRACE = timedelta(days=14)
# The one reminder email goes out this long before the checked cover ends.
REMINDER_BEFORE_EXPIRY = timedelta(days=30)

InsuranceStatus = Literal["missing", "awaiting_check", "verified", "expiring", "expired"]


def requires_insurance(service_keys: Iterable[str] | None) -> bool:
    """True when any of the vendor's services needs public liability cover."""
    return any(
        str(service_key).strip().lower() in INSURANCE_REQUIRED_SERVICES for service_key in service_keys or []
    )


def insurance_status(
    *,
    certificate_url: str | None,
    verified_certificate_url: str | None,
    expires_on: date | None,
    today: date,
) -> InsuranceStatus:
    """Where the vendor's cover stands, for staff and for the vendor.

    A certificate on file that is not the one staff checked (a first upload or a
    renewal) reads `awaiting_check`, even while the older checked cover still runs.
    """
    if certificate_url and certificate_url != verified_certificate_url:
        return "awaiting_check"
    if expires_on is None:
        return "missing"
    if expires_on < today:
        return "expired"
    if expires_on - today <= REMINDER_BEFORE_EXPIRY:
        return "expiring"
    return "verified"


def has_valid_insurance(expires_on: date | None, *, today: date) -> bool:
    """True when staff checked cover that has not ended yet (the badge, and the approval gate)."""
    return expires_on is not None and expires_on >= today


def insurance_allows_listing(*, required: bool, expires_on: date | None, today: date) -> bool:
    """True when insurance does not stop the vendor being listed.

    Checked cover keeps the listing for `EXPIRY_GRACE` after it ends. A vendor with no
    checked cover at all is only listed before `INSURANCE_REQUIRED_FROM` (approved earlier).
    """
    if not required:
        return True
    if expires_on is not None:
        return today <= expires_on + EXPIRY_GRACE
    return today < INSURANCE_REQUIRED_FROM
