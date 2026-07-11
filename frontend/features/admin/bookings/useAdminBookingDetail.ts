"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminBookingDetail } from "@/lib/adminPlatformApi";

export function useAdminBookingDetail(bookingId: string) {
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const b = await fetchAdminBookingDetail(bookingId);
      setBooking(b);
    } catch {
      setError("Could not load booking.");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { booking, loading, error, reload: load };
}
