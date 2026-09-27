"use client";

/**
 * Load one public vendor for the profile page.
 * Loading is derived from whether the stored result still matches this id.
 */
import { useEffect, useState } from "react";
import { fetchExploreVendorById, type ExploreVendorRow } from "./api";

type VendorFetchResult = {
  key: string;
  vendor: ExploreVendorRow | null;
  error: string | null;
};

/** Vendor row, plus loading / not-found / error for the profile page. */
export function useExploreVendor(userId: string) {
  const [result, setResult] = useState<VendorFetchResult | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchExploreVendorById(userId)
      .then((row) => {
        if (cancelled) return;
        setResult({ key: userId, vendor: row, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          key: userId,
          vendor: null,
          error: "Could not load this vendor right now.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return { vendor: undefined, loading: false, error: null, notFound: false };
  }

  const loading = result?.key !== userId;
  const vendor = loading ? undefined : (result?.vendor ?? undefined);
  const error = loading ? null : (result?.error ?? null);
  const notFound = !loading && !error && !vendor;
  return { vendor, loading, error, notFound };
}
