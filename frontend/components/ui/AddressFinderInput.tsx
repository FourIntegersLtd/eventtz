"use client";

/**
 * Address lookup (getAddress.io / OS Places) is disabled — free-text venue fields only.
 * Kept as a thin wrapper so older imports still work.
 */
import {
  VenueAddressFields,
  type VenueAddressValue,
} from "@/components/ui/VenueAddressFields";

export type AddressFinderValue = {
  postcode: string;
  formattedAddress: string | null;
};

export type AddressFinderInputProps = {
  label: string;
  value: AddressFinderValue;
  onChange: (next: AddressFinderValue) => void;
  placeholder?: string;
  helpText?: string;
  inputId?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export function AddressFinderInput({
  label,
  value,
  onChange,
  helpText,
  disabled,
}: AddressFinderInputProps) {
  const venue: VenueAddressValue = {
    postcode: value.postcode,
    address: value.formattedAddress ?? "",
  };

  return (
    <VenueAddressFields
      value={venue}
      disabled={disabled}
        showPostcode={false}
        postcodeLabel={label}
      addressLabel="Venue address"
      addressHelp={helpText}
      onChange={(next) =>
        onChange({
          postcode: next.postcode,
          formattedAddress: next.address.trim() || null,
        })
      }
    />
  );
}
