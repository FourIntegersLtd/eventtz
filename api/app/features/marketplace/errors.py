"""Errors the marketplace slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, NotFound


class InvalidVendorId(InvalidInput):
    """The vendor id in the path is not a UUID."""

    code = "vendor_id_invalid"
    default_message = "We couldn't find that vendor."


class VendorNotListed(NotFound):
    """No publicly listed vendor with that id (or a QA vendor the caller may not see)."""

    code = "vendor_not_listed"
    default_message = "Vendor not found or not listed."


class InvalidAddressId(InvalidInput):
    """The address id is too long to be one."""

    code = "address_id_invalid"
    default_message = "Invalid address id."


class AddressNotResolved(NotFound):
    """No address lookup provider could resolve the id (none is configured, as in the baseline)."""

    code = "address_not_resolved"
    default_message = (
        "Could not resolve that address. Configure OS_PLACES_API_KEY (OS Places API on "
        "OS Data Hub - not Maps) or GETADDRESS_API_KEY, then try again."
    )
