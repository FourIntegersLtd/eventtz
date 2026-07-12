"use client";

import { useId } from "react";

export type VenueAddressValue = {
  postcode: string;
  address: string;
};

type VenueAddressFieldsProps = {
  value: VenueAddressValue;
  onChange: (next: VenueAddressValue) => void;
  disabled?: boolean;
  showPostcode?: boolean;
  postcodeLabel?: string;
  addressLabel?: string;
  addressHelp?: string;
  addressRequired?: boolean;
};

export function VenueAddressFields({
  value,
  onChange,
  disabled = false,
  showPostcode = false,
  postcodeLabel = "Postcode *",
  addressLabel = "Venue address *",
  addressHelp,
  addressRequired = true,
}: VenueAddressFieldsProps) {
  const reactId = useId();
  const postcodeId = `venue-postcode-${reactId}`;
  const addressId = `venue-address-${reactId}`;

  return (
    <div className="space-y-4">
      {showPostcode ? (
        <div>
          <label htmlFor={postcodeId} className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {postcodeLabel}
          </label>
          <input
            id={postcodeId}
            type="text"
            autoComplete="postal-code"
            value={value.postcode}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, postcode: e.target.value })}
            placeholder="e.g. SW1A 1AA"
            className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-50 disabled:text-neutral-500"
          />
        </div>
      ) : null}
      <div>
        <label htmlFor={addressId} className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {addressLabel}
          {!addressRequired ? (
            <span className="ml-1 font-normal normal-case text-neutral-400">(optional)</span>
          ) : null}
        </label>
        <textarea
          id={addressId}
          rows={3}
          value={value.address}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="e.g. The Grand Hall, 12 Park Lane, London"
          className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-neutral-50 disabled:text-neutral-500"
        />
        {addressHelp ? <p className="mt-1 text-xs text-neutral-500">{addressHelp}</p> : null}
      </div>
    </div>
  );
}
