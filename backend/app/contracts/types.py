"""Shared backend enums and type aliases."""

from typing import Literal, TypeAlias

UserType: TypeAlias = Literal["client", "vendor", "admin"]
VendorApprovalStatus: TypeAlias = Literal["pending", "approved", "banned"]
VendorProfileStatus: TypeAlias = Literal["draft", "submitted", "complete"]
