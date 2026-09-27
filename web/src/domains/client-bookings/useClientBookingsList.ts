"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";
import {
  fetchClientBookings,
  markAllClientBookingNotificationsRead,
  type ClientBookingListItem,
} from "@/domains/client-bookings/api";
import type { BookingListTab } from "@/domains/client-bookings/bookingCopy";
import { parseBookingsListQuery } from "@/domains/client-bookings/listQuery";

/** One completed (or failed) fetch, tagged with the tab and filter it answered. */
interface ListResult {
  requestKey: string;
  bookings: ClientBookingListItem[];
  error: string | null;
}

/**
 * Loads the client's bookings for one tab (active/closed), refetching
 * whenever the tab changes. The URL's `?tab=` picks the starting tab and
 * `?status=pending` narrows the list, as in the baseline. Opening the list
 * also marks booking notifications read, like the baseline controller.
 *
 * `loading` is derived from whether the latest result answers the current
 * tab and filter, rather than toggled with its own `setState` call in the
 * effect body — every `setState` here happens inside the fetch promise's
 * `.then`/`.catch`, which keeps this effect out of the "setState
 * synchronously in an effect" lint rule.
 */
export function useClientBookingsList() {
  const searchParams = useSearchParams();
  const query = parseBookingsListQuery(searchParams.get("tab"), searchParams.get("status"));
  const [tab, setTab] = useState<BookingListTab>(query.tab);
  const [result, setResult] = useState<ListResult | null>(null);
  const statusFilter = query.status;
  const requestKey = `${tab}:${statusFilter ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    fetchClientBookings({ group: tab, status: statusFilter })
      .then((rows) => {
        if (!cancelled) setResult({ requestKey: `${tab}:${statusFilter ?? ""}`, bookings: rows, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            requestKey: `${tab}:${statusFilter ?? ""}`,
            bookings: [],
            error: platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, statusFilter]);

  useEffect(() => {
    // Best effort, as in the baseline: a failure only leaves the badge until the next refresh.
    markAllClientBookingNotificationsRead().catch(() => undefined);
  }, []);

  const loading = result === null || result.requestKey !== requestKey;
  return {
    tab,
    setTab,
    bookings: loading ? [] : result.bookings,
    loading,
    error: loading ? null : result.error,
  };
}
