"use client";

import { useEffect, useState } from "react";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";
import { fetchVendorBookings, type VendorBookingListItem, type VendorBookingsListGroup } from "@/domains/vendor-bookings/api";

/** One completed (or failed) fetch, tagged with the bucket it answered. */
interface ListResult {
  group: VendorBookingsListGroup;
  bookings: VendorBookingListItem[];
  error: string | null;
}

/**
 * Loads the vendor's bookings for one bucket, refetching whenever the
 * bucket changes.
 *
 * `loading` is derived from whether the latest result answers the
 * currently-selected bucket, rather than toggled with its own `setState`
 * call in the effect body — every `setState` here happens inside the fetch
 * promise's `.then`/`.catch`, which is what keeps this effect out of the
 * "setState synchronously in an effect" lint rule (see `useVerifyEmail` for
 * the same shape).
 */
export function useVendorBookingsList() {
  const [group, setGroup] = useState<VendorBookingsListGroup>("active");
  const [result, setResult] = useState<ListResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVendorBookings({ group })
      .then((rows) => {
        if (!cancelled) setResult({ group, bookings: rows, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ group, bookings: [], error: platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE });
      });
    return () => {
      cancelled = true;
    };
  }, [group]);

  const loading = result === null || result.group !== group;
  return {
    group,
    setGroup,
    bookings: loading ? [] : result.bookings,
    loading,
    error: loading ? null : result.error,
  };
}
