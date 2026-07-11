"use client";

import { useEffect, useState } from "react";
import { fetchExploreVendors } from "@/lib/clientExploreApi";
import { CATEGORIES } from "@/features/landing/landingData";

/** How many approved vendors list each category — a vendor counts once per category it offers. */
export function useCategoryVendorCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const vendors = await fetchExploreVendors();
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const { value } of CATEGORIES) next[value] = 0;
        for (const vendor of vendors) {
          const services = vendor.payload?.servicesOffered;
          if (!Array.isArray(services)) continue;
          for (const service of services) {
            const key = String(service);
            if (key in next) next[key] += 1;
          }
        }
        setCounts(next);
      } catch {
        if (!cancelled) setCounts({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { counts, loading };
}
