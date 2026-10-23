"use client";

import { useState } from "react";
import { useServerList } from "@/lib/useServerList";
import {
  fetchAdminBookings,
  type AdminBookingListItem,
  type AdminBookingsQuery,
} from "@/lib/adminPlatformApi";

/** The filters that narrow the admin bookings list; changing any of them returns to page 1. */
type AdminBookingFilters = {
  status: string;
  dateFrom: string;
  dateTo: string;
  needsAttentionOnly: boolean;
};

/** State for the admin bookings list: server-paged rows plus the filter and search the screen edits. */
export function useAdminBookings(initial?: Partial<AdminBookingsQuery>) {
  const [status, setStatus] = useState(initial?.status ?? "");
  const [search, setSearch] = useState(initial?.search ?? "");
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? "");
  const [dateTo, setDateTo] = useState(initial?.date_to ?? "");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(
    Boolean(initial?.needs_attention),
  );

  const list = useServerList<AdminBookingListItem, AdminBookingFilters>({
    filters: { status, dateFrom, dateTo, needsAttentionOnly },
    search,
    errorMessage: "Could not load bookings.",
    fetchPage: async ({ offset, limit, filters, search: searchText }) => {
      const page = await fetchAdminBookings({
        offset,
        limit,
        status: filters.status || undefined,
        search: searchText || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        needs_attention: filters.needsAttentionOnly || undefined,
      });
      return { items: page.bookings, total: page.total };
    },
  });

  return {
    rows: list.items,
    total: list.total,
    offset: list.offset,
    limit: list.limit,
    setOffset: list.setOffset,
    loading: list.loading,
    error: list.error,
    status,
    setStatus,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    reload: list.reload,
  };
}
