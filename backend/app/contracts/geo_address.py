from pydantic import BaseModel, Field


class AddressAutocompleteItem(BaseModel):
    id: str
    address: str


class AddressAutocompleteResponse(BaseModel):
    success: bool = True
    suggestions: list[AddressAutocompleteItem] = Field(default_factory=list)
    provider_configured: bool = True


class AddressResolveResponse(BaseModel):
    success: bool = True
    postcode: str
    formatted_line: str
    line_1: str | None = None
    town_or_city: str | None = None
    county: str | None = None


class AddressFindResponse(BaseModel):
    """All address lines at a postcode (OS Places)."""

    success: bool = True
    addresses: list[str] = Field(default_factory=list)
    provider_configured: bool = True
