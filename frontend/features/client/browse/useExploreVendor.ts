"use client";

import { useEffect, useState } from "react";
import { fetchExploreVendorById, type ExploreVendor } from "@/lib/clientExploreApi";

export function useExploreVendor(userId: string | undefined) {
  const [vendor, setVendor] = useState<ExploreVendor | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setVendor(undefined);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const row = await fetchExploreVendorById(userId);
        if (cancelled) return;
        setVendor(row ?? undefined);
      } catch {
        if (cancelled) return;
        setError("Could not load this vendor right now.");
        setVendor(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const notFound = !loading && !error && Boolean(userId) && !vendor;

  return { vendor, loading, error, notFound };
}
