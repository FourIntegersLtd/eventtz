/**
 * UK address lookup API — DISABLED (getAddress.io / OS Places commented out).
 * Venue addresses use free text via VenueAddressFields instead.
 */

export type AddressAutocompleteItem = { id: string; address: string };

export type AddressAutocompleteResult = {
  suggestions: AddressAutocompleteItem[];
  providerConfigured: boolean;
};

export async function fetchAddressAutocomplete(
  _term: string,
): Promise<AddressAutocompleteResult> {
  // getAddress.io / OS Places lookup disabled — use VenueAddressFields free text.
  return { suggestions: [], providerConfigured: false };
}

export type AddressResolveResult = {
  postcode: string;
  formatted_line: string;
};

export async function fetchAddressResolve(_addressId: string): Promise<AddressResolveResult> {
  // getAddress.io / OS Places lookup disabled — use VenueAddressFields free text.
  throw new Error("Address lookup is disabled.");
}

export type AddressFindResult = {
  addresses: string[];
  providerConfigured: boolean;
};

export async function fetchAddressFindByPostcode(_postcode: string): Promise<AddressFindResult> {
  // getAddress.io / OS Places lookup disabled — use VenueAddressFields free text.
  return { addresses: [], providerConfigured: false };
}

/*
import api from "./axios";

export async function fetchAddressAutocomplete(term: string): Promise<AddressAutocompleteResult> {
  const { data } = await api.get<{
    suggestions: AddressAutocompleteItem[];
    provider_configured?: boolean;
  }>("/api/v1/client/geo/address-autocomplete", { params: { term } });
  return {
    suggestions: data.suggestions ?? [],
    providerConfigured: data.provider_configured ?? true,
  };
}

export async function fetchAddressResolve(addressId: string): Promise<AddressResolveResult> {
  const { data } = await api.get<AddressResolveResult>(
    `/api/v1/client/geo/address-resolve/${encodeURIComponent(addressId)}`,
  );
  return data;
}

export async function fetchAddressFindByPostcode(postcode: string): Promise<AddressFindResult> {
  const { data } = await api.get<{ addresses: string[]; provider_configured?: boolean }>(
    "/api/v1/client/geo/address-find",
    { params: { postcode } },
  );
  return {
    addresses: Array.isArray(data.addresses) ? data.addresses : [],
    providerConfigured: data.provider_configured ?? true,
  };
}
*/
