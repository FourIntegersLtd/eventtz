"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  addClientFavorite,
  fetchClientFavoriteVendorIds,
  mergeClientFavorites,
  removeClientFavorite,
} from "@/lib/clientFavoritesApi";

const STORAGE_KEY = "eventtz_saved_vendor_ids";
const MERGED_KEY = "eventtz_favorites_merged";

function readLocalIds(): Set<string> {
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

function writeLocalIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function clearLocalIds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function useMarketplaceBookmarks() {
  const { user } = useAuth();
  const isClient = user?.user_type === "client";
  const clientId = isClient ? String(user?.id || "") : "";

  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const mergeAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isClient && clientId) {
        try {
          const localIds = [...readLocalIds()];
          const mergeFlag = window.localStorage.getItem(MERGED_KEY);
          if (localIds.length > 0 && mergeFlag !== clientId && !mergeAttempted.current) {
            mergeAttempted.current = true;
            await mergeClientFavorites(localIds);
            window.localStorage.setItem(MERGED_KEY, clientId);
            clearLocalIds();
          }
          const serverIds = await fetchClientFavoriteVendorIds();
          if (!cancelled) setSaved(new Set(serverIds));
        } catch {
          if (!cancelled) setSaved(readLocalIds());
        }
      } else {
        setSaved(readLocalIds());
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, clientId]);

  const toggle = useCallback(
    (vendorUserId: string) => {
      const wasSaved = saved.has(vendorUserId);
      setSaved((prev) => {
        const next = new Set(prev);
        if (next.has(vendorUserId)) next.delete(vendorUserId);
        else next.add(vendorUserId);
        if (!isClient) writeLocalIds(next);
        return next;
      });

      if (isClient && clientId) {
        void (async () => {
          try {
            if (wasSaved) await removeClientFavorite(vendorUserId);
            else await addClientFavorite(vendorUserId);
          } catch {
            setSaved((prev) => {
              const next = new Set(prev);
              if (wasSaved) next.add(vendorUserId);
              else next.delete(vendorUserId);
              return next;
            });
          }
        })();
      }
    },
    [saved, isClient, clientId],
  );

  const isSaved = useCallback(
    (vendorUserId: string) => saved.has(vendorUserId),
    [saved],
  );

  return {
    isSaved,
    toggle,
    savedCount: saved.size,
    savedIds: saved,
    ready,
  };
}
