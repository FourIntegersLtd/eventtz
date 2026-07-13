"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminBookings,
  type AdminBookingListItem,
  type AdminBookingsQuery,
} from "@/lib/adminPlatformApi";

export function useAdminBookings(initial?: Partial<AdminBookingsQuery>) {
  const [rows, setRows] = useState<AdminBookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initial?.status ?? "");
  const [search, setSearch] = useState(initial?.search ?? "");
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? "");
  const [dateTo, setDateTo] = useState(initial?.date_to ?? "");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(
    Boolean(initial?.needs_attention),
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const q: AdminBookingsQuery = {
        offset,
        limit,
        status: status || undefined,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        needs_attention: needsAttentionOnly || undefined,
      };
      const res = await fetchAdminBookings(q);
      setRows(res.bookings);
      setTotal(res.total);
    } catch {
      setError("Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [offset, limit, status, search, dateFrom, dateTo, needsAttentionOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    rows,
    total,
    offset,
    limit,
    setOffset,
    loading,
    error,
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
    reload: load,
  };
}
