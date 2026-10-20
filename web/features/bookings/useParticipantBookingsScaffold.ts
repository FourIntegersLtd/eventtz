"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingListTab } from "@/features/bookings/BookingListPanel";
import {
  type BookingListActivityFields,
  sortBookingListItemsRecentFirst,
} from "@/features/bookings/bookingListOrder";
import { bookingTabForStatus } from "@/features/bookings/bookingListConstants";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

export type ParticipantBookingsListPage<TListItem> = {
  items: TListItem[];
  total: number;
  offset: number;
  limit: number;
};

type UseParticipantBookingsScaffoldOptions<
  TListItem extends BookingListActivityFields,
  TDetail,
> = {
  selectedBookingId?: string;
  fetchListPage: (
    tab: BookingListTab,
    offset: number,
    limit: number,
  ) => Promise<ParticipantBookingsListPage<TListItem>>;
  pageSize: number;
  fetchDetail: (id: string) => Promise<TDetail>;
  getDetailStatus: (detail: TDetail) => string;
};

export function useParticipantBookingsScaffold<
  TListItem extends BookingListActivityFields,
  TDetail,
>({
  selectedBookingId,
  fetchListPage,
  pageSize,
  fetchDetail,
  getDetailStatus,
}: UseParticipantBookingsScaffoldOptions<TListItem, TDetail>) {
  const [tab, setTab] = useState<BookingListTab>("active");
  const [list, setList] = useState<TListItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listOffset, setListOffset] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const page = await fetchListPage(tab, listOffset, pageSize);
      setList(sortBookingListItemsRecentFirst(page.items));
      setListTotal(page.total);
    } catch {
      setListError("Could not load bookings.");
      setList([]);
      setListTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [fetchListPage, tab, listOffset, pageSize]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setListOffset(0);
  }, [tab]);

  useRealtimeRefresh(
    "bookings:refresh",
    () => {
      void loadList();
      setDetailTick((n) => n + 1);
    },
    [tab, listOffset, loadList],
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

  const setTabAndResetPage = useCallback((next: BookingListTab) => {
    setListOffset(0);
    setTab(next);
  }, []);

  return {
    tab,
    setTab: setTabAndResetPage,
    list,
    listTotal,
    listOffset,
    listPageSize: pageSize,
    setListOffset,
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
    loadList,
  };
}
