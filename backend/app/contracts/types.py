"""Shared backend enums and type aliases."""

from typing import Literal, TypeAlias

UserType: TypeAlias = Literal["client", "vendor", "admin"]
VendorApprovalStatus: TypeAlias = Literal["pending", "approved", "banned"]
VendorListingOverride: TypeAlias = Literal["auto", "visible", "hidden"]
VendorProfileStatus: TypeAlias = Literal["draft", "submitted", "complete"]
