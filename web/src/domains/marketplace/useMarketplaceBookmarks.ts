"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/foundation/session";
import {
  addClientFavorite,
  fetchClientFavoriteVendorIds,
  mergeClientFavorites,
  removeClientFavorite,
} from "./api";
import { shouldMergeGuestFavorites } from "./marketplaceBookmarkMerge";

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

/**
 * Client favorites with optimistic toggle, rollback on failure,
 * and one-time merge of guest bookmarks from localStorage.
 * When the user is not signed in, favorites live only in localStorage.
 */
export function useMarketplaceBookmarks() {
  const { session, ready: sessionReady } = useSession();
  const isClient = session?.user.user_type === "client";
  const clientId = isClient ? String(session?.user.id ?? "") : "";

  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mergeAttempted = useRef(false);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;

    void (async () => {
      if (isClient && clientId) {
        try {
          const localIds = [...readLocalIds()];
          const mergeFlag = window.localStorage.getItem(MERGED_KEY);
          if (
            shouldMergeGuestFavorites(localIds, mergeFlag, clientId) &&
            !mergeAttempted.current
          ) {
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
  }, [isClient, clientId, sessionReady]);

  const toggle = useCallback(
    (vendorUserId: string) => {
      setError(null);
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
            setError(wasSaved ? "Could not remove favorite" : "Could not save favorite");
          }
        })();
      } else {
      writeLocalIds(saved);
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
    error,
    setError,
  };
}
