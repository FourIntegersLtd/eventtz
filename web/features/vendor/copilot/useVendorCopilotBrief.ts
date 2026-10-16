"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import {
  fetchVendorCopilotBrief,
  getCachedVendorCopilotBrief,
  type VendorCopilotBrief,
  vendorCopilotErrorMessage,
} from "@/lib/vendorCopilotApi";

export function useVendorCopilotBrief() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [brief, setBrief] = useState<VendorCopilotBrief | null>(() =>
    userId ? getCachedVendorCopilotBrief(userId) : null,
  );
  const [loading, setLoading] = useState(() => !(userId && getCachedVendorCopilotBrief(userId)));
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBrief(null);
      setLoading(false);
      return;
    }

    setError(null);
    const hasCached = Boolean(getCachedVendorCopilotBrief(userId));
    if (!hasCached) {
      setLoading(true);
    } else {
      setRevalidating(true);
    }

    try {
      const data = await fetchVendorCopilotBrief({ userId });
      setBrief(data);
    } catch (e: unknown) {
      setError(vendorCopilotErrorMessage(e));
    } finally {
      setLoading(false);
      setRevalidating(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBrief(null);
      setLoading(false);
      return;
    }
    const cached = getCachedVendorCopilotBrief(userId);
    setBrief(cached);
    setLoading(!cached);
    void refresh();
  }, [userId, refresh]);

  useRealtimeRefresh(
    ["bookings:refresh", "booking_notifications:refresh"],
    () => void refresh(),
    [refresh],
  );

  return { brief, loading, revalidating, error, refresh };
}
