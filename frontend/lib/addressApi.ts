import api from "./axios";

export type AddressAutocompleteItem = { id: string; address: string };

export type AddressAutocompleteResult = {
  suggestions: AddressAutocompleteItem[];
  /** False when neither OS Places nor getAddress.io is configured server-side. */
  providerConfigured: boolean;
};

export async function fetchAddressAutocomplete(
  term: string,
): Promise<AddressAutocompleteResult> {
  const { data } = await api.get<{
    suggestions: AddressAutocompleteItem[];
    provider_configured?: boolean;
  }>("/api/v1/client/geo/address-autocomplete", { params: { term } });
  return {
    suggestions: data.suggestions ?? [],
    providerConfigured: data.provider_configured ?? true,
  };
}

export type AddressResolveResult = {
  postcode: string;
  formatted_line: string;
};

export async function fetchAddressResolve(addressId: string): Promise<AddressResolveResult> {
  const { data } = await api.get<AddressResolveResult>(
    `/api/v1/client/geo/address-resolve/${encodeURIComponent(addressId)}`,
  );
  return data;
}

export type AddressFindResult = {
  addresses: string[];
  /** False when neither OS Places nor getAddress.io is configured server-side. */
  providerConfigured: boolean;
};

/** All street-level lines at a UK postcode (OS Places / getAddress.io via backend). */
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
