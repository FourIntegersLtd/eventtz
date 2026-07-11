"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  AddressFinderInput,
  type AddressFinderValue,
} from "@/components/ui/AddressFinderInput";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchClientBookingDetail,
  fetchClientBookings,
  patchClientBookingStatus,
  postCancelClientBooking,
  postClientConfirmCompletion,
  type ClientBookingDetail,
  type ClientBookingListItem,
} from "@/lib/clientBookingsApi";
import { ClientBookingReviewForm } from "@/features/client/bookings/ClientBookingReviewForm";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel, type BookingListTab } from "@/features/bookings/BookingListPanel";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import {
  toClientBookingDetailViewModel,
  toClientBookingRowViewModel,
} from "@/features/client/bookings/clientBookingViewModel";
import {
  BOOKING_NOTIFICATIONS_CLEARED_EVENT,
  markAllClientBookingNotificationsRead,
} from "@/lib/clientNotificationsApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

function groupForStatus(status: string): BookingListTab {
  if (status === "pending" || status === "accepted") return "active";
  return "closed";
}

const EMPTY_LIST_TITLE: Record<BookingListTab, string> = {
  active: "No active bookings",
  closed: "No closed bookings",
};

type ClientBookingsViewProps = {
  /** Present on `/client/bookings/[bookingId]` — absent on the `/client/bookings` index. */
  selectedBookingId?: string;
};

export function ClientBookingsView({ selectedBookingId }: ClientBookingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rateParam = Number(searchParams.get("rate") ?? "");
  const deepLinkRating = rateParam >= 1 && rateParam <= 5 ? rateParam : undefined;

  const [tab, setTab] = useState<BookingListTab>("active");
  const [list, setList] = useState<ClientBookingListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientBookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<null | "accept" | "decline">(null);
  const [quoteAcceptVenue, setQuoteAcceptVenue] = useState<AddressFinderValue>({
    postcode: "",
    formattedAddress: null,
  });
  const paymentBannerRef = useRef<HTMLDivElement>(null);
  const paymentDue = detail?.status === "accepted" && detail?.payment_status === "unpaid";

  useEffect(() => {
    if (paymentDue) {
      paymentBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paymentDue, detail?.id]);

  useEffect(() => {
    setQuoteAcceptVenue({ postcode: "", formattedAddress: null });
  }, [selectedBookingId]);

  useEffect(() => {
    void markAllClientBookingNotificationsRead()
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(BOOKING_NOTIFICATIONS_CLEARED_EVENT));
        }
      })
      .catch(() => {
        /* ignore — sidebar badge will refresh on nav/focus/SSE */
      });
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await fetchClientBookings(tab);
      setList(rows);
    } catch {
      setListError("Could not load bookings.");
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, [tab]);

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
    void fetchClientBookingDetail(selectedBookingId)
      .then((b) => {
        if (cancelled) return;
        setDetail(b);
        setTab((prev) => (groupForStatus(b.status) === prev ? prev : groupForStatus(b.status)));
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
  }, [selectedBookingId, detailTick]);

  const confirmCancelBooking = async () => {
    if (!detail?.id) return;
    setActionError(null);
    setActionBusy(true);
    try {
      await postCancelClientBooking(detail.id);
      setCancelOpen(false);
      setDetailTick((n) => n + 1);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not cancel this booking.");
    } finally {
      setActionBusy(false);
    }
  };

  const applyClientQuoteResponse = async (next: "accepted" | "declined") => {
    if (!detail?.id) return;
    if (detail.initiator !== "vendor" || detail.status !== "pending") return;
    const bookingId = detail.id;
    setActionError(null);
    setActionBusy(true);
    setPendingQuoteAction(next === "accepted" ? "accept" : "decline");
    try {
      if (next === "accepted") {
        const pc = quoteAcceptVenue.postcode.trim().replace(/\s+/g, " ");
        if (pc.length < 2) {
          setActionError("Enter the event postcode or pick an address before accepting this quote.");
          return;
        }
        await patchClientBookingStatus(bookingId, next, {
          event_postcode: pc,
          event_address: quoteAcceptVenue.formattedAddress,
        });
      } else {
        await patchClientBookingStatus(bookingId, next);
      }
      setDetailTick((n) => n + 1);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this quote.");
    } finally {
      setActionBusy(false);
      setPendingQuoteAction(null);
    }
  };

  const [confirmingCompletion, setConfirmingCompletion] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const confirmCompletion = async () => {
    if (!detail?.id) return;
    setActionError(null);
    setConfirmingCompletion(true);
    try {
      await postClientConfirmCompletion(detail.id);
      setConfirmCompleteOpen(false);
      setDetailTick((n) => n + 1);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not confirm completion.");
    } finally {
      setConfirmingCompletion(false);
    }
  };

  const paymentBanner = searchParams.get("payment");

  const rows = list.map(toClientBookingRowViewModel);
  const viewModel = detail
    ? toClientBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const footerActions: BookingDetailAction[] = [];
  if (
    detail &&
    (detail.status === "pending" || detail.status === "accepted") &&
    !(detail.initiator === "vendor" && detail.status === "pending")
  ) {
    footerActions.push({
      key: "cancel",
      label: "Cancel booking",
      variant: "destructive",
      disabled: actionBusy,
      onClick: () => {
        setActionError(null);
        setCancelOpen(true);
      },
    });
    if (detail.status === "accepted" && detail.payment_status === "paid") {
      if (!detail.client_completion_confirmed_at) {
        footerActions.push({
          key: "confirm-completion",
          label: "Confirm event complete",
          loadingLabel: "Confirming…",
          variant: "primary",
          disabled: actionBusy,
          loading: confirmingCompletion,
          onClick: () => setConfirmCompleteOpen(true),
        });
      }
    }
  }

  const headerActions: BookingDetailAction[] = [];
  if (detail && detail.initiator === "vendor" && detail.status === "pending") {
    headerActions.push(
      {
        key: "accept",
        label: "Accept quote",
        loadingLabel: "Accepting…",
        variant: "primary",
        disabled: actionBusy,
        loading: pendingQuoteAction === "accept",
        onClick: () => void applyClientQuoteResponse("accepted"),
      },
      {
        key: "decline",
        label: "Decline",
        loadingLabel: "Declining…",
        variant: "destructive",
        disabled: actionBusy,
        loading: pendingQuoteAction === "decline",
        onClick: () => void applyClientQuoteResponse("declined"),
      },
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={cancelOpen}
        title="Cancel this booking?"
        cancelLabel="Keep booking"
        confirmLabel="Yes, cancel"
        confirmLoadingLabel="Cancelling…"
        confirmVariant="destructive"
        loading={actionBusy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void confirmCancelBooking()}
      />

      <ConfirmDialog
        isOpen={confirmCompleteOpen}
        title="Confirm the event is complete?"
        confirmLabel="Confirm complete"
        confirmLoadingLabel="Confirming…"
        confirmVariant="primary"
        loading={confirmingCompletion}
        onCancel={() => setConfirmCompleteOpen(false)}
        onConfirm={() => void confirmCompletion()}
      />

      {detail ? (
        <ChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          portal="client"
          counterpartyName={detail.vendor_display_name}
          conversationId={detail.conversation_id}
          counterpartyUserId={detail.vendor_user_id}
          onConversationCreated={(conversationId) => {
            setDetail((d) => (d && d.id === detail.id ? { ...d, conversation_id: conversationId } : d));
          }}
        />
      ) : null}

      <MasterDetailLayout
        hasSelection={!!selectedBookingId}
        list={
          <BookingListPanel
            tab={tab}
            onTabChange={setTab}
            rows={rows}
            loading={listLoading}
            error={listError}
            selectedId={selectedBookingId ?? null}
            onSelect={(id) => router.push(`/client/bookings/${id}`)}
            emptyTitle={EMPTY_LIST_TITLE[tab]}
          />
        }
        detail={
          <>
            {selectedBookingId ? (
              <button
                type="button"
                onClick={() => router.push("/client/bookings")}
                className="mb-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 lg:hidden"
              >
                ← Back to bookings
              </button>
            ) : null}
            <BookingDetailPanel
              booking={viewModel}
              loading={detailLoading}
              error={detailError}
              actionError={actionError}
              headerActions={headerActions}
              footerActions={footerActions}
              emptyTitle={list.length === 0 ? "No bookings yet" : "Select a booking"}
              slots={{
                beforeSections:
                  detail ? (
                    <>
                      {paymentBanner === "success" || paymentBanner === "cancelled" ? (
                        <div
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            paymentBanner === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                          }`}
                        >
                          {paymentBanner === "success"
                            ? "Payment successful — thanks! The vendor has been notified."
                            : "Checkout was cancelled. You can try paying again whenever you're ready."}
                        </div>
                      ) : null}

                      {paymentDue ? (
                        <div
                          ref={paymentBannerRef}
                          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-amber-950">
                              Payment needed to confirm this booking
                            </p>
                            <p className="mt-1 text-sm text-amber-900/90">
                              The vendor has accepted — pay now to secure your date. The vendor
                              can&apos;t start preparing or mark the event complete until your
                              payment goes through.
                            </p>
                          </div>
                          <Button
                            variant="primary"
                            size="md"
                            className="shrink-0"
                            onClick={() => router.push(`/client/bookings/${detail.id}/pay`)}
                          >
                            Pay now
                          </Button>
                        </div>
                      ) : null}

                      {detail.initiator === "vendor" && detail.status === "pending" ? (
                        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                          <AddressFinderInput
                            label="Venue location *"
                            value={quoteAcceptVenue}
                            disabled={actionBusy}
                            onChange={setQuoteAcceptVenue}
                            placeholder="Postcode or address"
                          />
                        </div>
                      ) : null}
                    </>
                  ) : undefined,
                afterSections:
                  detail && detail.status === "completed" ? (
                    detail.review ? (
                      <section className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/80">
                          Your review
                        </p>
                        <p className="mt-2 text-sm text-neutral-700">
                          {detail.review.rating} out of 5 stars. Thanks for helping the community.
                        </p>
                      </section>
                    ) : (
                      <ClientBookingReviewForm
                        bookingId={detail.id}
                        vendorName={detail.vendor_display_name}
                        initialRating={deepLinkRating}
                        onSubmitted={(rev) => {
                          setDetail((d) => (d && d.id === detail.id ? { ...d, review: rev } : d));
                        }}
                      />
                    )
                  ) : undefined,
                disputeSection: detail ? (
                  <BookingDisputeSection
                    bookingId={detail.id}
                    role="client"
                    bookingStatus={detail.status}
                    presentation="drawer"
                  />
                ) : (
                  <></>
                ),
              }}
            />
          </>
        }
      />
    </>
  );
}
