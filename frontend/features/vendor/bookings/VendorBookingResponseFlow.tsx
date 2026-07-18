"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BOOKING_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { VendorBookingResponseAdjustments } from "@/features/vendor/bookings/VendorBookingResponseAdjustments";
import {
  draftsFromDetail,
  friendlyMoneyLabel,
  hasSavedPriceUpdate,
  type AdjDraftRow,
} from "@/features/vendor/bookings/vendorBookingResponseHelpers";
import { fetchConversation } from "@/lib/chatApi";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";

type PendingDecision = "accept" | "decline";

type VendorBookingResponseFlowProps = {
  detail: VendorBookingDetail;
  actionBusy: boolean;
  adjSaving: boolean;
  onAcceptAtListedPrice: () => void;
  onDecline: () => void;
  onSendUpdatedPrice: (rows: AdjDraftRow[]) => void;
  /** Opens the booking chat drawer so the vendor can read unread client messages. */
  onOpenChat: () => void;
};

export function VendorBookingResponseFlow({
  detail,
  actionBusy,
  adjSaving,
  onAcceptAtListedPrice,
  onDecline,
  onSendUpdatedPrice,
  onOpenChat,
}: VendorBookingResponseFlowProps) {
  const listedTotal =
    detail.pricing?.client_total_label ??
    detail.initial_client_total_label ??
    detail.total_label;
  const friendlyTotal = friendlyMoneyLabel(listedTotal);

  const waitingForClient = hasSavedPriceUpdate(detail);
  const [step, setStep] = useState<"review" | "adjust">("review");
  const [adjustInitialLines, setAdjustInitialLines] = useState<AdjDraftRow[]>([]);
  const [adjustKey, setAdjustKey] = useState(0);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [unreadGateOpen, setUnreadGateOpen] = useState(false);
  const [checkingDecision, setCheckingDecision] = useState<PendingDecision | null>(null);

  const openAdjust = (saved: AdjDraftRow[]) => {
    setAdjustInitialLines(saved);
    setAdjustKey((k) => k + 1);
    setStep("adjust");
  };

  const requestDecision = async (kind: PendingDecision) => {
    if (actionBusy || adjSaving || checkingDecision) return;
    setCheckingDecision(kind);
    try {
      const conversationId = detail.conversation_id?.trim();
      if (conversationId) {
        try {
          const conv = await fetchConversation(conversationId);
          if ((conv.unread_count ?? 0) > 0) {
            setPendingDecision(kind);
            setUnreadGateOpen(true);
            return;
          }
        } catch {
          // Non-fatal: if unread check fails, proceed to the normal confirm dialog.
        }
      } else if ((detail.notes ?? "").trim()) {
        // Older bookings may only have notes on the booking (not yet mirrored to chat).
        setPendingDecision(kind);
        setUnreadGateOpen(true);
        return;
      }
      setPendingDecision(kind);
    } finally {
      setCheckingDecision(null);
    }
  };

  if (waitingForClient && step !== "adjust") {
    const currentTotal = friendlyMoneyLabel(
      detail.pricing?.client_total_label ?? detail.total_label,
    );
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Waiting for them to accept your new price ({currentTotal}).
        </p>
        <button
          type="button"
          onClick={() => openAdjust(draftsFromDetail(detail))}
          className="text-sm font-medium text-primary hover:underline"
        >
          Edit price
        </button>
      </div>
    );
  }

  if (step === "adjust") {
    return (
      <VendorBookingResponseAdjustments
        key={`${detail.id}-${adjustKey}`}
        pricing={detail.pricing}
        initialLines={adjustInitialLines}
        actionBusy={actionBusy}
        adjSaving={adjSaving}
        onBack={() => setStep("review")}
        onSendUpdatedPrice={onSendUpdatedPrice}
      />
    );
  }

  const acceptCopy = BOOKING_CONFIRM_COPY.acceptBooking;
  const declineCopy = BOOKING_CONFIRM_COPY.declineBooking;
  const unreadCopy = BOOKING_CONFIRM_COPY.reviewUnreadBeforeRespond;
  const confirmOpen = pendingDecision !== null && !unreadGateOpen;
  const hasChatThread = Boolean(detail.conversation_id?.trim());
  const unreadGateDescription = hasChatThread
    ? unreadCopy.description
    : "The client left details on this booking. Review “Notes from client” above, then try again.";
  const unreadGateConfirmLabel = hasChatThread ? unreadCopy.confirmLabel : "OK";

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">
          Their estimate:{" "}
          <span className="font-semibold text-neutral-900">{friendlyTotal}</span>
          <span className="text-neutral-500"> (incl. Eventtz fee)</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjSaving || !!checkingDecision}
            loading={checkingDecision === "accept"}
            onClick={() => void requestDecision("accept")}
          >
            Accept booking
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={actionBusy || adjSaving || !!checkingDecision}
            onClick={() => openAdjust([])}
          >
            Suggest a different price
          </Button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={actionBusy || adjSaving || !!checkingDecision}
            onClick={() => void requestDecision("decline")}
            className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
          >
            Can&apos;t take this one
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={unreadGateOpen}
        title={unreadCopy.title}
        description={unreadGateDescription}
        cancelLabel={unreadCopy.cancelLabel}
        confirmLabel={unreadGateConfirmLabel}
        confirmVariant="primary"
        onCancel={() => {
          setUnreadGateOpen(false);
          setPendingDecision(null);
        }}
        onConfirm={() => {
          setUnreadGateOpen(false);
          setPendingDecision(null);
          if (hasChatThread) onOpenChat();
        }}
      />

      <ConfirmDialog
        isOpen={confirmOpen && pendingDecision === "accept"}
        title={acceptCopy.title}
        description={acceptCopy.description}
        cancelLabel={acceptCopy.cancelLabel}
        confirmLabel={acceptCopy.confirmLabel}
        confirmLoadingLabel={acceptCopy.confirmLoadingLabel}
        confirmVariant="primary"
        loading={actionBusy}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          setPendingDecision(null);
          onAcceptAtListedPrice();
        }}
      />

      <ConfirmDialog
        isOpen={confirmOpen && pendingDecision === "decline"}
        title={declineCopy.title}
        description={declineCopy.description}
        cancelLabel={declineCopy.cancelLabel}
        confirmLabel={declineCopy.confirmLabel}
        confirmLoadingLabel={declineCopy.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={actionBusy}
        onCancel={() => setPendingDecision(null)}
        onConfirm={() => {
          setPendingDecision(null);
          onDecline();
        }}
      />
    </>
  );
}
