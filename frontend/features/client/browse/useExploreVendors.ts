"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchExploreVendors, type ExploreVendor } from "@/lib/clientExploreApi";

export function useExploreVendors(query: string) {
  const [vendors, setVendors] = useState<ExploreVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchExploreVendors();
        if (cancelled) return;
        setVendors(rows);
      } catch {
        if (cancelled) return;
        setError("Could not load approved vendors right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => {
      const p = v.payload ?? {};
      const biz = typeof p.businessName === "string" ? p.businessName : "";
      const city = typeof p.baseCity === "string" ? p.baseCity : "";
      const services = Array.isArray(p.servicesOffered)
        ? p.servicesOffered.map((s) => String(s)).join(" ")
        : "";
      const events = Array.isArray(p.eventTypes)
        ? p.eventTypes.map((s) => String(s)).join(" ")
        : "";
      const haystack = [biz, city, services, events, v.email ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [vendors, query]);

  return { vendors, filteredVendors, loading, error };
}
