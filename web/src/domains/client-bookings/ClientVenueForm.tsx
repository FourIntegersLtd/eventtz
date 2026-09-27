"use client";

import { useState } from "react";
import { Button, TextField } from "@/foundation/ui";
import { parseVenueForm, toUpdateVenueBody } from "@/domains/client-bookings/venueForm";
import type { UpdateBookingVenueBody } from "@/domains/client-bookings/api";

/**
 * Sets the venue of an accepted booking before the client pays. Validation
 * and the request body come from `venueForm.ts` (zod), so this component only
 * holds the draft strings and submits.
 */
export function ClientVenueForm({
  initialAddress,
  initialPostcode,
  saving,
  onSave,
}: {
  initialAddress?: string | null;
  initialPostcode?: string | null;
  saving: boolean;
  onSave: (body: UpdateBookingVenueBody) => void;
}) {
  const [eventAddress, setEventAddress] = useState(initialAddress ?? "");
  const [eventPostcode, setEventPostcode] = useState(initialPostcode ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function submit() {
    const result = parseVenueForm({ eventAddress, eventPostcode });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    onSave(toUpdateVenueBody(result.data));
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Event address"
        error={fieldErrors.eventAddress}
        value={eventAddress}
        onChange={(event) => setEventAddress(event.target.value)}
      />
      <TextField
        label="Postcode (optional)"
        error={fieldErrors.eventPostcode}
        value={eventPostcode}
        onChange={(event) => setEventPostcode(event.target.value)}
      />
      {formError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{formError}</p>
      ) : null}
      <Button type="submit" loading={saving}>
        Save venue
      </Button>
    </form>
  );
}
