"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";

/** One page of rows as the api's `PagedResponse` returns it (`core/pagination.py`). */
export type ServerListPage<TItem> = {
  items: TItem[];
  total: number;
};

/** What `fetchPage` is asked for: the window, the caller's filters and the trimmed search text. */
export type ServerListQuery<TFilters> = {
  offset: number;
  limit: number;
  filters: TFilters;
  search: string;
};

/** Page position remembered together with the filters it belongs to. */
export type ServerListPaging = {
  key: string;
  offset: number;
};

/** Identity of a filter + search combination; the offset restarts at 0 whenever it changes. */
export function serverListKey(filters: unknown, search: string): string {
  return JSON.stringify([filters, search.trim()]);
}

/** The offset to use now: the remembered one, unless the filters or search changed since it was set. */
export function resolveOffset(paging: ServerListPaging, key: string): number {
  return paging.key === key ? paging.offset : 0;
}

/** Offset of the next page, staying put on the last page. */
export function nextOffset(offset: number, limit: number, total: number): number {
  return offset + limit < total ? offset + limit : offset;
}

/** Offset of the previous page, never below the first. */
export function previousOffset(offset: number, limit: number): number {
  return Math.max(0, offset - limit);
}

/** What the newest answered request returned; `requestKey` says which request it answers. */
export type ServerListOutcome<TItem> = {
  requestKey: string;
  items: TItem[];
  total: number;
  error: string | null;
};

/** The outcome of a failed request: the last good rows stay on screen so a transient error does not blank the table. The rows may belong to an earlier query; show `error` beside them. */
export function failedOutcome<TItem>(
  previous: ServerListOutcome<TItem>,
  requestKey: string,
  error: string,
): ServerListOutcome<TItem> {
  return { requestKey, items: previous.items, total: previous.total, error };
}

type UseServerListOptions<TItem, TFilters> = {
  /** Loads one window. May be an inline function: the latest one is used, so it needs no memoising. */
  fetchPage: (query: ServerListQuery<TFilters>) => Promise<ServerListPage<TItem>>;
  /** Plain JSON-serialisable filters; changing them returns to the first page. */
  filters: TFilters;
  /** Free-text search; changing it returns to the first page. */
  search?: string;
  pageSize?: number;
  errorMessage?: string;
};

/**
 * State for a list the api pages with offset and limit (`PageParams`): rows, total, loading, error and
 * paging. Filters and search stay with the caller (component state or the URL), so a screen can sync
 * them wherever it likes; the hook only owns the offset and resets it when they change.
 */
export function useServerList<TItem, TFilters = Record<string, never>>({
  fetchPage,
  filters,
  search = "",
  pageSize = DEFAULT_LIST_PAGE_SIZE,
  errorMessage = "Could not load this list.",
}: UseServerListOptions<TItem, TFilters>) {
  const key = serverListKey(filters, search);
  const [paging, setPaging] = useState<ServerListPaging>({ key, offset: 0 });
  const offset = resolveOffset(paging, key);
  const [reloadTick, setReloadTick] = useState(0);
  const [outcome, setOutcome] = useState<ServerListOutcome<TItem>>({
    requestKey: "",
    items: [],
    total: 0,
    error: null,
  });

  // Loading is derived: the newest request has not answered yet. No state is set before the fetch starts.
  const requestKey = `${key}|${offset}|${pageSize}|${reloadTick}`;
  const loading = outcome.requestKey !== requestKey;

  // The latest callbacks, read by the fetch effect without making it re-run on every render.
  const latest = useRef({ fetchPage, filters, search, errorMessage });
  useEffect(() => {
    latest.current = { fetchPage, filters, search, errorMessage };
  });

  useEffect(() => {
    let cancelled = false;
    const current = latest.current;
    current
      .fetchPage({ offset, limit: pageSize, filters: current.filters, search: current.search.trim() })
      .then((page) => {
        if (!cancelled) setOutcome({ requestKey, items: page.items, total: page.total, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setOutcome((previous) => failedOutcome(previous, requestKey, latest.current.errorMessage));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, offset, pageSize]);

  const setOffset = (next: number) => setPaging({ key, offset: Math.max(0, next) });
  const goNext = () => setOffset(nextOffset(offset, pageSize, outcome.total));
  const goPrevious = () => setOffset(previousOffset(offset, pageSize));
  const reload = () => setReloadTick((tick) => tick + 1);

  return {
    items: outcome.items,
    total: outcome.total,
    offset,
    limit: pageSize,
    loading,
    error: loading ? null : outcome.error,
    setOffset,
    goNext,
    goPrevious,
    reload,
  };
}
