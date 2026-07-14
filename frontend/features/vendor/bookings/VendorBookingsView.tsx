"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BackLink } from "@/components/ui/BackLink";
import {
  BOOKING_CONFIRM_COPY,
  PAYMENT_FLOW_COPY,
} from "@/features/bookings/bookingConfirmCopy";
import { BookingCompletionBanner } from "@/features/bookings/BookingCompletionBanner";
import { getApiErrorDetail } from "@/lib/api-errors";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel } from "@/features/bookings/BookingListPanel";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import { VendorBookingResponseFlow } from "@/features/vendor/bookings/VendorBookingResponseFlow";
import {
  fetchVendorBookingDetail,
  fetchVendorBookings,
  patchVendorBookingStatus,
  postVendorConfirmCompletion,
  putVendorBookingAdjustments,
  type VendorBookingDetail,
} from "@/lib/vendorBookingsApi";
import {
  toVendorBookingDetailViewModel,
  toVendorBookingRowViewModel,
} from "@/features/vendor/bookings/vendorBookingViewModel";

type AdjDraftRow = {
  kind: "cost" | "discount";
  tag: string;
  label: string;
  amount: string;
};

type VendorBookingsViewProps = {
  /** Present on `/vendor/bookings/[bookingId]` — absent on the `/vendor/bookings` index. */
  selectedBookingId?: string;
};

export function VendorBookingsView({ selectedBookingId }: VendorBookingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listStatusFilter = searchParams.get("status") ?? "";
  const urlTab = searchParams.get("tab");

  const fetchList = useCallback(
    (t: "active" | "closed") =>
      fetchVendorBookings({
        group: t,
        ...(listStatusFilter === "pending" ? { status: "pending" } : {}),
      }),
    [listStatusFilter],
  );
  const fetchDetail = useCallback((id: string) => fetchVendorBookingDetail(id), []);
  const getDetailStatus = useCallback((b: VendorBookingDetail) => b.status, []);

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
  const [pendingAction, setPendingAction] = useState<
    null | "accept" | "decline" | "complete" | "vendor_cancel" | "withdraw"
  >(null);
  const [adjSaving, setAdjSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "withdraw" | "vendor_cancel" | "complete">(
    null,
  );

  const applyBookingStatus = async (next: "accepted" | "declined") => {
    if (!detail?.id) return;
    if (detail.initiator === "vendor") return;
    if (next === "declined" && detail.status !== "pending") return;
    if (next === "accepted" && detail.status !== "pending" && detail.status !== "declined") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction(next === "accepted" ? "accept" : "decline");
    try {
      await patchVendorBookingStatus(detail.id, next);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not update this booking.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const applyWithdrawVendorQuote = async () => {
    if (!detail?.id || detail.status !== "pending" || detail.initiator !== "vendor") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("withdraw");
    try {
      await patchVendorBookingStatus(detail.id, "cancelled");
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not withdraw this quote.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const applyVendorCancel = async () => {
    if (!detail?.id || detail.status !== "accepted") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("vendor_cancel");
    try {
      await patchVendorBookingStatus(detail.id, "cancelled");
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not cancel this booking.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const applyConfirmCompletion = async () => {
    if (!detail?.id || detail.status !== "accepted" || detail.payment_status !== "paid") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction("complete");
    try {
      await postVendorConfirmCompletion(detail.id);
      bumpDetail();
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not confirm completion.");
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const sendUpdatedPrice = async (rows: AdjDraftRow[]) => {
    if (!detail?.id || detail.status !== "pending") return;
    setActionError(null);
    const parsed: { tag: string; label: string; amount_gbp: number }[] = [];
    for (const r of rows) {
      const raw = Number.parseFloat(r.amount);
      if (!Number.isFinite(raw) || raw <= 0) {
        setActionError("Each line needs a valid positive amount.");
        return;
      }
      const amount_gbp = r.kind === "discount" ? -raw : raw;
      if (r.kind === "cost" && !r.label.trim()) {
        setActionError("Say what each extra charge is for.");
        return;
      }
      parsed.push({
        tag: (r.tag || "other").trim() || "other",
        label: r.label.trim() || (r.kind === "discount" ? "Discount" : "Additional cost"),
        amount_gbp,
      });
    }
    if (parsed.length === 0) {
      setActionError("Add a charge or discount first.");
      return;
    }
    setAdjSaving(true);
    try {
      const updated = await putVendorBookingAdjustments(detail.id, parsed);
      setDetail(updated);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not send the updated price.");
    } finally {
      setAdjSaving(false);
    }
  };

  const rows = useMemo(() => list.map(toVendorBookingRowViewModel), [list]);
  const viewModel = detail
    ? toVendorBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const headerActions: BookingDetailAction[] = [];
  if (detail?.status === "pending" && detail.initiator === "vendor") {
    headerActions.push({
      key: "withdraw",
      label: "Withdraw quote",
      loadingLabel: "Withdrawing…",
      variant: "destructive",
      disabled: actionBusy,
      loading: pendingAction === "withdraw",
      onClick: () => setConfirmAction("withdraw"),
    });
  } else if (detail?.status === "declined" && detail.initiator !== "vendor") {
    headerActions.push({
      key: "accept",
      label: "Accept booking",
      loadingLabel: "Accepting…",
      variant: "primary",
      disabled: actionBusy,
      loading: pendingAction === "accept",
      onClick: () => void applyBookingStatus("accepted"),
    });
  }

  const footerActions: BookingDetailAction[] = [];
  if (
    detail?.status === "accepted" &&
    detail.payment_status !== "payout_released"
  ) {
    if (detail.payment_status === "paid" && !detail.vendor_completion_confirmed_at) {
      footerActions.push({
        key: "complete",
        label: "Confirm event complete",
        loadingLabel: "Confirming…",
        variant: "primary",
        disabled: actionBusy,
        loading: pendingAction === "complete",
        onClick: () => setConfirmAction("complete"),
      });
    }
    footerActions.push({
      key: "vendor_cancel",
      label: "Cancel booking",
      loadingLabel: "Cancelling…",
      variant: "secondary",
      disabled: actionBusy,
      loading: pendingAction === "vendor_cancel",
      onClick: () => setConfirmAction("vendor_cancel"),
    });
  }

  const vendorCancelCopy =
    detail?.payment_status === "paid"
      ? BOOKING_CONFIRM_COPY.cancelVendorPaid
      : BOOKING_CONFIRM_COPY.cancelVendor;

  const confirmCopy: Record<
    "withdraw" | "vendor_cancel" | "complete",
    {
      title: string;
      description: string;
      confirmLabel: string;
      loadingLabel: string;
      cancelLabel?: string;
      variant: "destructive" | "primary";
    }
  > = {
    withdraw: {
      title: BOOKING_CONFIRM_COPY.withdrawQuote.title,
      description: BOOKING_CONFIRM_COPY.withdrawQuote.description,
      cancelLabel: BOOKING_CONFIRM_COPY.withdrawQuote.cancelLabel,
      confirmLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.withdrawQuote.confirmLoadingLabel,
      variant: "destructive",
    },
    vendor_cancel: {
      title: vendorCancelCopy.title,
      description: vendorCancelCopy.description,
      cancelLabel: vendorCancelCopy.cancelLabel,
      confirmLabel: vendorCancelCopy.confirmLabel,
      loadingLabel: vendorCancelCopy.confirmLoadingLabel,
      variant: "destructive",
    },
    complete: {
      title: BOOKING_CONFIRM_COPY.confirmComplete.title,
      description: BOOKING_CONFIRM_COPY.confirmComplete.description,
      confirmLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLabel,
      loadingLabel: BOOKING_CONFIRM_COPY.confirmComplete.confirmLoadingLabel,
      variant: "primary",
    },
  };

  const showClientResponseFlow =
    detail?.status === "pending" && detail.initiator !== "vendor";

  return (
    <>
      {confirmAction ? (
        <ConfirmDialog
          isOpen
          title={confirmCopy[confirmAction].title}
          description={confirmCopy[confirmAction].description}
          cancelLabel={confirmCopy[confirmAction].cancelLabel}
          confirmLabel={confirmCopy[confirmAction].confirmLabel}
          confirmLoadingLabel={confirmCopy[confirmAction].loadingLabel}
          confirmVariant={confirmCopy[confirmAction].variant}
          loading={actionBusy}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action === "withdraw") void applyWithdrawVendorQuote();
            else if (action === "vendor_cancel") void applyVendorCancel();
            else if (action === "complete") void applyConfirmCompletion();
          }}
        />
      ) : null}
      {detail ? (
        <ChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          portal="vendor"
          counterpartyName={detail.client_email ?? "this client"}
          conversationId={detail.conversation_id}
          counterpartyUserId={detail.client_user_id ?? undefined}
          onConversationCreated={(conversationId) => {
            setDetail((d) =>
              d && d.id === detail.id ? { ...d, conversation_id: conversationId } : d,
            );
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
            onSelect={(id) => router.push(`/vendor/bookings/${id}`)}
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[tab]}
          />
        }
        detail={
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {selectedBookingId ? (
              <BackLink
                href="/vendor/bookings"
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
                beforeSections: detail ? (
                  <>
                    {detail.status === "accepted" && detail.payment_status === "unpaid" ? (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
                        <p className="text-sm font-semibold text-amber-950">
                          Waiting on the client&apos;s payment
                        </p>
                        <p className="mt-1 text-sm text-amber-900/90">
                          The client hasn&apos;t paid yet. You&apos;ll be able to confirm the event is
                          complete once their payment goes through.
                        </p>
                      </div>
                    ) : null}

                    <BookingCompletionBanner
                      viewer="vendor"
                      status={detail.status}
                      paymentStatus={detail.payment_status}
                      eventDate={detail.event_date}
                      eventEndDate={detail.event_end_date}
                      waitingOn={detail.completion_waiting_on}
                      autoReleaseAt={detail.payout_auto_release_at}
                      confirmDisabled={actionBusy}
                      onConfirm={() => setConfirmAction("complete")}
                    />

                    {detail.status === "cancelled" &&
                    (detail.payment_status === "refunded" ||
                      detail.payment_status === "partially_refunded") ? (
                      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 pb-4 pt-5 text-sm text-neutral-700">
                        {PAYMENT_FLOW_COPY.cancelledRefundedVendor}
                      </div>
                    ) : null}
                  </>
                ) : undefined,
                footerSection: showClientResponseFlow ? (
                  <VendorBookingResponseFlow
                    key={`${detail.id}-${detail.vendor_adjustments.length}`}
                    detail={detail}
                    actionBusy={actionBusy}
                    adjSaving={adjSaving}
                    onAcceptAtListedPrice={() => void applyBookingStatus("accepted")}
                    onDecline={() => void applyBookingStatus("declined")}
                    onSendUpdatedPrice={(rows) => void sendUpdatedPrice(rows)}
                    onOpenChat={() => setChatOpen(true)}
                  />
                ) : undefined,
                afterSections:
                  detail && detail.status === "completed" ? (
                    <BookingReviewPanel
                      title="Client review"
                      review={detail.review}
                      showReviewer
                      emptyLabel="The client has not left a review for this booking yet."
                    />
                  ) : undefined,
                disputeSection: detail ? (
                  <BookingDisputeSection
                    bookingId={detail.id}
                    role="vendor"
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
