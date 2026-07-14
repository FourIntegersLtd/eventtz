"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resolveWasClientTotalLabel } from "@/lib/bookingPriceLabels";
import { getApiErrorDetail, postBookingCheckoutSync } from "@/lib/bookingCheckoutApi";
import { BookingPriceUpdateBanner } from "@/features/bookings/BookingPriceUpdateBanner";
import {
  fetchClientBookingDetail,
  fetchClientBookings,
  patchClientBookingStatus,
  postCancelClientBooking,
  postClientConfirmCompletion,
  type ClientBookingDetail,
} from "@/lib/clientBookingsApi";
import { ClientBookingReviewForm } from "@/features/client/bookings/ClientBookingReviewForm";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel } from "@/features/bookings/BookingListPanel";
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
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import {
  BOOKING_CONFIRM_COPY,
  PAYMENT_FLOW_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";

type ClientBookingsViewProps = {
  /** Present on `/client/bookings/[bookingId]` — absent on the `/client/bookings` index. */
  selectedBookingId?: string;
};

export function ClientBookingsView({ selectedBookingId }: ClientBookingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rateParam = Number(searchParams.get("rate") ?? "");
  const deepLinkRating = rateParam >= 1 && rateParam <= 5 ? rateParam : undefined;
  const listStatusFilter = searchParams.get("status") ?? "";
  const urlTab = searchParams.get("tab");

  const fetchList = useCallback(
    (t: "active" | "closed") =>
      fetchClientBookings({
        group: t,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
      }),
    [listStatusFilter],
  );
  const fetchDetail = useCallback((id: string) => fetchClientBookingDetail(id), []);
  const getDetailStatus = useCallback((b: ClientBookingDetail) => b.status, []);

  const {
    tab,
    setTab,
    list,
    listLoading,
    listError,
    detail,
    setDetail,
    detailLoading,
    detailError,
    bumpDetail,
    actionError,
    setActionError,
    chatOpen,
    setChatOpen,
  } = useParticipantBookingsScaffold({
    selectedBookingId,
    fetchList,
    fetchDetail,
    getDetailStatus,
  });

  useEffect(() => {
    if (urlTab === "active" || urlTab === "closed") {
      setTab(urlTab);
    }
  }, [urlTab, setTab]);

  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineQuoteOpen, setDeclineQuoteOpen] = useState(false);
  const [declinePriceOpen, setDeclinePriceOpen] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<null | "accept" | "decline">(null);
  const [pendingPriceAction, setPendingPriceAction] = useState<null | "accept" | "decline">(null);
  const paymentBannerRef = useRef<HTMLDivElement>(null);
  const pendingPaymentSyncRef = useRef<string | null>(null);
  const checkoutReturnSyncRef = useRef<string | null>(null);
  const paymentDue =
    detail?.status === "accepted" &&
    (detail?.payment_status === "unpaid" || detail?.payment_status === "pending");

  useEffect(() => {
    if (paymentDue) {
      paymentBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [paymentDue, detail?.id]);

  useEffect(() => {
    pendingPaymentSyncRef.current = null;
    checkoutReturnSyncRef.current = null;
  }, [selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId || detail?.payment_status !== "pending") return;
    if (pendingPaymentSyncRef.current === selectedBookingId) return;
    pendingPaymentSyncRef.current = selectedBookingId;
    void postBookingCheckoutSync(selectedBookingId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (booking.payment_status === "paid" || booking.payment_status === "payout_released") {
          setDetail(booking);
          bumpDetail();
        }
      })
      .catch(() => {
        /* webhook may still be in flight, or checkout was abandoned */
      });
  }, [selectedBookingId, detail?.payment_status, bumpDetail, setDetail]);

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

  const confirmCancelBooking = async () => {
    if (!detail?.id) return;
    setActionError(null);
    setActionBusy(true);
    try {
      await postCancelClientBooking(detail.id);
      setCancelOpen(false);
      bumpDetail();
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
      await patchClientBookingStatus(bookingId, next);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this quote.");
    } finally {
      setActionBusy(false);
      setPendingQuoteAction(null);
    }
  };

  const applyClientUpdatedPriceResponse = async (next: "accepted" | "declined") => {
    if (!detail?.id) return;
    if (detail.initiator !== "client" || detail.status !== "pending") return;
    if (detail.vendor_adjustments.length === 0) return;
    const bookingId = detail.id;
    setActionError(null);
    setActionBusy(true);
    setPendingPriceAction(next === "accepted" ? "accept" : "decline");
    try {
      await patchClientBookingStatus(bookingId, next);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this booking.");
    } finally {
      setActionBusy(false);
      setPendingPriceAction(null);
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
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not confirm completion.");
    } finally {
      setConfirmingCompletion(false);
    }
  };

  const paymentBanner = searchParams.get("payment");
  const checkoutSessionId = searchParams.get("session_id");
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null);

  const paymentConfirmed =
    detail?.payment_status === "paid" || detail?.payment_status === "payout_released";

  /** Strip checkout redirect params once payment is already recorded. */
  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (!paymentConfirmed) return;
    router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
      scroll: false,
    });
  }, [selectedBookingId, paymentBanner, paymentConfirmed, router]);

  useEffect(() => {
    if (!selectedBookingId || paymentBanner !== "success") return;
    if (paymentConfirmed) return;

    const syncKey = `${selectedBookingId}:${checkoutSessionId ?? ""}`;
    if (checkoutReturnSyncRef.current === syncKey) return;
    checkoutReturnSyncRef.current = syncKey;

    let cancelled = false;
    setPaymentSyncError(null);
    void postBookingCheckoutSync(selectedBookingId, checkoutSessionId)
      .then(() => fetchClientBookingDetail(selectedBookingId))
      .then((booking) => {
        if (cancelled) return;
        setDetail(booking);
        bumpDetail();
        router.replace(`/client/bookings/${encodeURIComponent(selectedBookingId)}`, {
          scroll: false,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPaymentSyncError(
            getApiErrorDetail(e) ??
              "Payment went through. Refresh in a moment if it doesn't update.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedBookingId,
    paymentBanner,
    checkoutSessionId,
    paymentConfirmed,
    router,
    setDetail,
    bumpDetail,
  ]);

  const showCheckoutReturnBanner =
    paymentBanner === "success" || paymentBanner === "cancelled";
  const checkoutReturnMessage =
    paymentBanner === "cancelled"
      ? "Payment cancelled. Try again when you're ready."
      : paymentSyncError
        ? paymentSyncError
        : paymentConfirmed
          ? PAYMENT_FLOW_COPY.paymentSuccess
          : "Confirming your payment…";

  const rows = useMemo(() => list.map(toClientBookingRowViewModel), [list]);
  const viewModel = detail
    ? toClientBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const showUpdatedPriceBanner =
    detail?.status === "pending" &&
    detail.initiator === "client" &&
    detail.vendor_adjustments.length > 0;

  const clientCancelCopy =
    detail?.payment_status === "paid"
      ? BOOKING_CONFIRM_COPY.cancelClientPaid
      : BOOKING_CONFIRM_COPY.cancelClient;

  const showCancelledRefunded =
    detail?.status === "cancelled" &&
    (detail.payment_status === "refunded" || detail.payment_status === "partially_refunded");

  const footerActions: BookingDetailAction[] = [];
  const canCancel =
    detail &&
    (detail.status === "pending" || detail.status === "accepted") &&
    detail.payment_status !== "payout_released" &&
    !(detail.initiator === "vendor" && detail.status === "pending");
  if (canCancel) {
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
        onClick: () => setDeclineQuoteOpen(true),
      },
    );
  }

  return (
    <>
      <ConfirmDialog
        isOpen={cancelOpen}
        title={clientCancelCopy.title}
        description={clientCancelCopy.description}
        cancelLabel={clientCancelCopy.cancelLabel}
        confirmLabel={clientCancelCopy.confirmLabel}
        confirmLoadingLabel={clientCancelCopy.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={actionBusy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void confirmCancelBooking()}
      />

      <ConfirmDialog
        isOpen={confirmCompleteOpen}
        title={BOOKING_CONFIRM_COPY.confirmComplete.title}
        description={BOOKING_CONFIRM_COPY.confirmComplete.description}
        confirmLabel={BOOKING_CONFIRM_COPY.confirmComplete.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.confirmComplete.confirmLoadingLabel}
        confirmVariant="primary"
        loading={confirmingCompletion}
        onCancel={() => setConfirmCompleteOpen(false)}
        onConfirm={() => void confirmCompletion()}
      />

      <ConfirmDialog
        isOpen={declineQuoteOpen}
        title={BOOKING_CONFIRM_COPY.declineQuote.title}
        description={BOOKING_CONFIRM_COPY.declineQuote.description}
        cancelLabel={BOOKING_CONFIRM_COPY.declineQuote.cancelLabel}
        confirmLabel={BOOKING_CONFIRM_COPY.declineQuote.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.declineQuote.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={actionBusy && pendingQuoteAction === "decline"}
        onCancel={() => setDeclineQuoteOpen(false)}
        onConfirm={() => {
          setDeclineQuoteOpen(false);
          void applyClientQuoteResponse("declined");
        }}
      />

      <ConfirmDialog
        isOpen={declinePriceOpen}
        title={BOOKING_CONFIRM_COPY.declineUpdatedPrice.title}
        description={BOOKING_CONFIRM_COPY.declineUpdatedPrice.description}
        cancelLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.cancelLabel}
        confirmLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={actionBusy && pendingPriceAction === "decline"}
        onCancel={() => setDeclinePriceOpen(false)}
        onConfirm={() => {
          setDeclinePriceOpen(false);
          void applyClientUpdatedPriceResponse("declined");
        }}
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
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[tab]}
          />
        }
        detail={
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {selectedBookingId ? (
              <BackLink
                href="/client/bookings"
                label="Back to bookings"
                tone="muted"
                mobileOnly
                className="mb-3 shrink-0"
              />
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
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
                      {showUpdatedPriceBanner ? (
                        <BookingPriceUpdateBanner
                          wasTotalLabel={resolveWasClientTotalLabel(detail)}
                          nowTotalLabel={
                            detail.pricing?.client_total_label ?? detail.total_label
                          }
                          pricing={detail.pricing}
                          actionBusy={actionBusy}
                          pendingAction={pendingPriceAction}
                          onAccept={() => void applyClientUpdatedPriceResponse("accepted")}
                          onDecline={() => setDeclinePriceOpen(true)}
                        />
                      ) : null}

                      {showCheckoutReturnBanner ? (
                        <div
                          className={`mt-4 rounded-xl border px-4 pb-4 pt-5 text-sm ${
                            paymentBanner === "cancelled"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : paymentSyncError
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900"
                          }`}
                        >
                          {checkoutReturnMessage}
                        </div>
                      ) : null}

                      <BookingCompletionBanner
                        viewer="client"
                        status={detail.status}
                        paymentStatus={detail.payment_status}
                        eventDate={detail.event_date}
                        eventEndDate={detail.event_end_date}
                        waitingOn={detail.completion_waiting_on}
                        autoReleaseAt={detail.payout_auto_release_at}
                        confirmDisabled={actionBusy || confirmingCompletion}
                        onConfirm={() => setConfirmCompleteOpen(true)}
                      />

                      {showCancelledRefunded ? (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 pb-4 pt-5 text-sm text-emerald-900">
                          {PAYMENT_FLOW_COPY.cancelledRefunded}
                        </div>
                      ) : null}

                      {paymentDue ? (
                        <div
                          ref={paymentBannerRef}
                          className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 pb-4 pt-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-amber-950">
                              Payment needed
                            </p>
                            <p className="mt-1 text-sm text-amber-900/90">
                              Pay now to confirm your booking.
                            </p>
                            <p className="mt-1 text-xs text-amber-900/75">
                              {PAYMENT_FLOW_COPY.beforePay}
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
                    </>
                  ) : undefined,
                afterSections:
                  detail && detail.status === "completed" ? (
                    detail.review ? (
                      <BookingReviewPanel
                        title="Your review"
                        review={detail.review}
                        variant="amber"
                        emptyLabel="No review yet."
                      />
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
            </div>
          </div>
        }
      />
    </>
  );
}
