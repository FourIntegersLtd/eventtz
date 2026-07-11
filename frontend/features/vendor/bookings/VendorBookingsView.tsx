"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getApiErrorDetail } from "@/lib/api-errors";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel } from "@/features/bookings/BookingListPanel";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import type { BookingDetailAction } from "@/features/bookings/bookingViewModel";
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { useParticipantBookingsScaffold } from "@/features/bookings/useParticipantBookingsScaffold";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { getBookingServiceFeePercent } from "@/lib/bookingServiceFee";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
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

const ADJUSTMENT_TAGS = [
  { value: "delivery", label: "Delivery" },
  { value: "travel", label: "Travel" },
  { value: "materials", label: "Materials" },
  { value: "labour", label: "Extra labour" },
  { value: "discount", label: "Discount" },
  { value: "other", label: "Other" },
] as const;

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

  const fetchList = useCallback((t: "active" | "closed") => fetchVendorBookings(t), []);
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

  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    null | "accept" | "reject" | "complete" | "vendor_cancel" | "withdraw"
  >(null);
  const [adjDrafts, setAdjDrafts] = useState<AdjDraftRow[]>([]);
  const [adjSaving, setAdjSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "withdraw" | "vendor_cancel" | "complete">(
    null,
  );

  useEffect(() => {
    if (!detail?.vendor_adjustments) {
      setAdjDrafts([]);
      return;
    }
    setAdjDrafts(
      detail.vendor_adjustments.map((a) => ({
        kind: a.amount_gbp < 0 ? "discount" : "cost",
        tag: a.tag || "other",
        label: a.label,
        amount: String(Math.abs(a.amount_gbp)),
      })),
    );
  }, [detail?.id, detail?.vendor_adjustments]);

  const applyBookingStatus = async (next: "accepted" | "declined") => {
    if (!detail?.id) return;
    if (detail.initiator === "vendor") return;
    if (next === "declined" && detail.status !== "pending") return;
    if (next === "accepted" && detail.status !== "pending" && detail.status !== "declined") return;
    setActionError(null);
    setActionBusy(true);
    setPendingAction(next === "accepted" ? "accept" : "reject");
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

  const saveAdjustments = async () => {
    if (!detail?.id || detail.status !== "pending") return;
    setActionError(null);
    const filled = adjDrafts.filter((r) => r.label.trim() && r.amount.trim());
    const parsed: { tag: string; label: string; amount_gbp: number }[] = [];
    for (const r of filled) {
      const raw = Number.parseFloat(r.amount);
      if (!Number.isFinite(raw) || raw <= 0) {
        setActionError(
          "Each line needs a valid positive amount (discounts: enter the amount to take off).",
        );
        return;
      }
      const amount_gbp = r.kind === "discount" ? -raw : raw;
      parsed.push({ tag: (r.tag || "other").trim() || "other", label: r.label.trim(), amount_gbp });
    }
    setAdjSaving(true);
    try {
      const updated = await putVendorBookingAdjustments(detail.id, parsed);
      setDetail(updated);
    } catch (e: unknown) {
      setActionError(getApiErrorDetail(e) ?? "Could not save additional costs.");
    } finally {
      setAdjSaving(false);
    }
  };

  const rows = list.map(toVendorBookingRowViewModel);
  const viewModel = detail
    ? toVendorBookingDetailViewModel(detail, () => setChatOpen(true))
    : null;

  const headerActions: BookingDetailAction[] = [];
  if (detail?.status === "pending") {
    if (detail.initiator === "vendor") {
      headerActions.push({
        key: "withdraw",
        label: "Withdraw quote",
        loadingLabel: "Withdrawing…",
        variant: "destructive",
        disabled: actionBusy,
        loading: pendingAction === "withdraw",
        onClick: () => setConfirmAction("withdraw"),
      });
    } else {
      headerActions.push(
        {
          key: "accept",
          label: "Accept",
          loadingLabel: "Accepting…",
          variant: "primary",
          disabled: actionBusy,
          loading: pendingAction === "accept",
          onClick: () => void applyBookingStatus("accepted"),
        },
        {
          key: "reject",
          label: "Reject",
          loadingLabel: "Rejecting…",
          variant: "destructive",
          disabled: actionBusy,
          loading: pendingAction === "reject",
          onClick: () => void applyBookingStatus("declined"),
        },
      );
    }
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
  if (detail?.status === "accepted") {
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

  const confirmCopy: Record<
    "withdraw" | "vendor_cancel" | "complete",
    { title: string; confirmLabel: string; loadingLabel: string; variant: "destructive" | "primary" }
  > = {
    withdraw: {
      title: "Withdraw this quote?",
      confirmLabel: "Withdraw quote",
      loadingLabel: "Withdrawing…",
      variant: "destructive",
    },
    vendor_cancel: {
      title: "Cancel this booking?",
      confirmLabel: "Yes, cancel",
      loadingLabel: "Cancelling…",
      variant: "destructive",
    },
    complete: {
      title: "Confirm the event is complete?",
      confirmLabel: "Confirm complete",
      loadingLabel: "Confirming…",
      variant: "primary",
    },
  };

  return (
    <>
    {confirmAction ? (
      <ConfirmDialog
        isOpen
        title={confirmCopy[confirmAction].title}
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
          onSelect={(id) => router.push(`/vendor/bookings/${id}`)}
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[tab]}
        />
      }
      detail={
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {selectedBookingId ? (
            <button
              type="button"
              onClick={() => router.push("/vendor/bookings")}
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
                detail && detail.status === "accepted" && detail.payment_status === "unpaid" ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
                    <p className="text-sm font-semibold text-amber-950">
                      Waiting on the client&apos;s payment
                    </p>
                    <p className="mt-1 text-sm text-amber-900/90">
                      The client hasn&apos;t paid yet. You&apos;ll be able to confirm the event is
                      complete once their payment goes through.
                    </p>
                  </div>
                ) : detail && detail.status === "pending" && detail.initiator !== "vendor" ? (
                  <div className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Additional costs &amp; discounts (before you accept)
                    </p>
                    <p className="mt-1 text-xs text-amber-950/80">
                      Add delivery, travel, or other costs. Use a discount line to reduce the quote
                      (entered as a positive amount — the client sees it as a reduction). The Eventtz
                      service fee ({getBookingServiceFeePercent()}%) applies to the vendor portion
                      after adjustments.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {adjDrafts.map((row, idx) => (
                        <li
                          key={`${detail.id}-adj-${idx}`}
                          className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-white p-2 sm:flex-row sm:items-end"
                        >
                          <div className="w-full min-w-[7rem] sm:w-28">
                            <label className="text-[10px] font-medium text-neutral-500">Type</label>
                            <select
                              value={row.kind}
                              onChange={(e) => {
                                const t = [...adjDrafts];
                                const kind = e.target.value as "cost" | "discount";
                                const prev = t[idx];
                                t[idx] = {
                                  ...prev,
                                  kind,
                                  tag:
                                    kind === "discount"
                                      ? "discount"
                                      : prev.tag === "discount"
                                        ? "delivery"
                                        : prev.tag,
                                };
                                setAdjDrafts(t);
                              }}
                              className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                            >
                              <option value="cost">Extra cost</option>
                              <option value="discount">Discount</option>
                            </select>
                          </div>
                          <div className="min-w-0 flex-1">
                            <label className="text-[10px] font-medium text-neutral-500">Tag</label>
                            <select
                              value={row.tag}
                              onChange={(e) => {
                                const t = [...adjDrafts];
                                t[idx] = { ...t[idx], tag: e.target.value };
                                setAdjDrafts(t);
                              }}
                              className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                            >
                              {ADJUSTMENT_TAGS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="min-w-0 flex-[2]">
                            <label className="text-[10px] font-medium text-neutral-500">
                              Description
                            </label>
                            <input
                              type="text"
                              value={row.label}
                              onChange={(e) => {
                                const t = [...adjDrafts];
                                t[idx] = { ...t[idx], label: e.target.value };
                                setAdjDrafts(t);
                              }}
                              placeholder="e.g. Delivery to venue"
                              className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="w-full sm:w-28">
                            <label className="text-[10px] font-medium text-neutral-500">
                              {row.kind === "discount" ? "£ off" : "£"}
                            </label>
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.amount}
                              onChange={(e) => {
                                const t = [...adjDrafts];
                                t[idx] = { ...t[idx], amount: e.target.value };
                                setAdjDrafts(t);
                              }}
                              className="mt-0.5 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdjDrafts(adjDrafts.filter((_, i) => i !== idx))}
                            className="text-xs font-semibold text-red-700 hover:underline sm:mb-1"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAdjDrafts([...adjDrafts, { kind: "cost", tag: "delivery", label: "", amount: "" }])
                        }
                        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                      >
                        + Add cost
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAdjDrafts([
                            ...adjDrafts,
                            { kind: "discount", tag: "discount", label: "", amount: "" },
                          ])
                        }
                        className="rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
                      >
                        + Add discount
                      </button>
                      <button
                        type="button"
                        disabled={adjSaving || actionBusy}
                        onClick={() => void saveAdjustments()}
                        className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950 disabled:opacity-60"
                      >
                        {adjSaving ? "Saving…" : "Save adjustments"}
                      </button>
                    </div>
                  </div>
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
      }
    />
    </>
  );
}
