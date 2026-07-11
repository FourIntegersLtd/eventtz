"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "eventtz_saved_vendor_ids";

function readIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useMarketplaceBookmarks() {
  const [saved, setSaved] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // Hydrate from localStorage after mount (SSR-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount sync
    setSaved(readIds());
  }, []);

  const toggle = useCallback((vendorUserId: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(vendorUserId)) next.delete(vendorUserId);
      else next.add(vendorUserId);
      writeIds(next);
      return next;
    });
  }, []);

  const isSaved = useCallback(
    (vendorUserId: string) => saved.has(vendorUserId),
    [saved],
  );

  return { isSaved, toggle, savedCount: saved.size, savedIds: saved };
}
