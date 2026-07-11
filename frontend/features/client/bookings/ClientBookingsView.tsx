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

type ClientBookingsViewProps = {
  /** Present on `/client/bookings/[bookingId]` — absent on the `/client/bookings` index. */
  selectedBookingId?: string;
};

export function ClientBookingsView({ selectedBookingId }: ClientBookingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rateParam = Number(searchParams.get("rate") ?? "");
  const deepLinkRating = rateParam >= 1 && rateParam <= 5 ? rateParam : undefined;

  const fetchList = useCallback((t: "active" | "closed") => fetchClientBookings(t), []);
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

  const [actionBusy, setActionBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
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
      bumpDetail();
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
      bumpDetail();
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
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[tab]}
          />
        }
        detail={
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {selectedBookingId ? (
              <button
                type="button"
                onClick={() => router.push("/client/bookings")}
                className="mb-3 inline-flex w-fit shrink-0 items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 lg:hidden"
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
        }
      />
    </>
  );
}
