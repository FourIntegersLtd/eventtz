"use client";

import { useCallback, useEffect, useState } from "react";
import { type BookingListTab, bookingTabForStatus } from "@/features/bookings/bookingListConstants";
import {
  type BookingListActivityFields,
  sortBookingListItemsRecentFirst,
} from "@/features/bookings/bookingListOrder";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";
import {
  type ServerListPage,
  type ServerListQuery,
  useServerList,
} from "@/lib/useServerList";

/** Filters a bookings list sends to the api besides the search text. */
export type BookingsListFilters = {
  tab: BookingListTab;
  /** "" for every status, or "pending" for the notification deep link. */
  status: string;
};

type UseParticipantBookingsScaffoldOptions<
  TListItem extends BookingListActivityFields,
  TDetail,
> = {
  selectedBookingId?: string;
  /** The `?status=` value of the page URL. */
  listStatusFilter: string;
  fetchListPage: (
    query: ServerListQuery<BookingsListFilters>,
  ) => Promise<ServerListPage<TListItem>>;
  pageSize: number;
  fetchDetail: (id: string) => Promise<TDetail>;
  getDetailStatus: (detail: TDetail) => string;
};

/**
 * State shared by the client and vendor bookings screens: the paged list (on `useServerList`, filtered
 * by tab, status and search), the selected booking's detail, and the action and chat flags around it.
 */
export function useParticipantBookingsScaffold<
  TListItem extends BookingListActivityFields,
  TDetail,
>({
  selectedBookingId,
  listStatusFilter,
  fetchListPage,
  pageSize,
  fetchDetail,
  getDetailStatus,
}: UseParticipantBookingsScaffoldOptions<TListItem, TDetail>) {
  const [tab, setTab] = useState<BookingListTab>("active");
  const [listSearch, setListSearch] = useState("");
  const [detail, setDetail] = useState<TDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const {
    items: list,
    total: listTotal,
    offset: listOffset,
    loading: listLoading,
    error: listError,
    goNext: goListNext,
    goPrevious: goListPrevious,
    reload: reloadList,
  } = useServerList<TListItem, BookingsListFilters>({
    fetchPage: async (query) => {
      const page = await fetchListPage(query);
      return { items: sortBookingListItemsRecentFirst(page.items), total: page.total };
    },
    filters: { tab, status: listStatusFilter },
    search: listSearch,
    pageSize,
    errorMessage: "Could not load bookings.",
  });

  // Empty deps are safe: `reload` only bumps a counter, so it never goes stale.
  useRealtimeRefresh(
    "bookings:refresh",
    () => {
      reloadList();
      setDetailTick((n) => n + 1);
    },
    [],
  );

  useEffect(() => {
    setActionError(null);
    setChatOpen(false);
  }, [selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchDetail(selectedBookingId)
      .then((b) => {
        if (cancelled) return;
        setDetail(b);
        setTab((prev) => {
          const next = bookingTabForStatus(getDetailStatus(b));
          return next === prev ? prev : next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDetailError("Could not load this booking.");
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBookingId, detailTick, fetchDetail, getDetailStatus]);

  const bumpDetail = useCallback(() => setDetailTick((n) => n + 1), []);

  return {
    tab,
    setTab,
    listSearch,
    setListSearch,
    list,
    listTotal,
    listOffset,
    listPageSize: pageSize,
    goListNext,
    goListPrevious,
    listLoading,
    listError,
    detail,
    setDetail,
    detailLoading,
    detailError,
    detailTick,
    bumpDetail,
    actionError,
    setActionError,
    chatOpen,
    setChatOpen,
  };
}
