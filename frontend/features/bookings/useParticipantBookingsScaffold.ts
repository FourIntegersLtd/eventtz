"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingListTab } from "@/features/bookings/BookingListPanel";
import { bookingTabForStatus } from "@/features/bookings/bookingListConstants";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

type UseParticipantBookingsScaffoldOptions<TListItem, TDetail> = {
  selectedBookingId?: string;
  fetchList: (tab: BookingListTab) => Promise<TListItem[]>;
  fetchDetail: (id: string) => Promise<TDetail>;
  getDetailStatus: (detail: TDetail) => string;
};

export function useParticipantBookingsScaffold<TListItem, TDetail>({
  selectedBookingId,
  fetchList,
  fetchDetail,
  getDetailStatus,
}: UseParticipantBookingsScaffoldOptions<TListItem, TDetail>) {
  const [tab, setTab] = useState<BookingListTab>("active");
  const [list, setList] = useState<TListItem[]>([]);
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
      setList(await fetchList(tab));
    } catch {
      setListError("Could not load bookings.");
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, [fetchList, tab]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useRealtimeRefresh(
    "bookings:refresh",
    () => {
      void loadList();
      setDetailTick((n) => n + 1);
    },
    [tab, loadList],
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
    list,
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
