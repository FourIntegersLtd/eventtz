"use client";

import { useState } from "react";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { useAdminBookingDetail } from "@/features/admin/bookings/useAdminBookingDetail";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import { getApiErrorDetail } from "@/lib/api-errors";
import { adminCancelBookingSchema, parseForm } from "@/lib/validation";
import { AdminBookingDetailHeader } from "./AdminBookingDetailHeader";
import { AdminBookingDetailMainContent } from "./AdminBookingDetailMainContent";
import type { SupportAction } from "./AdminBookingDetailShared";
import {
  asArray,
  asClientReview,
  asPricing,
  asSupport,
  mapAdminLineItems,
} from "./adminBookingDetailUtils";
import { buildSupportActions } from "./adminBookingSupportActions";
import { AdminBookingSupportActionsPanel } from "./AdminBookingSupportActionsPanel";

type Props = {
  bookingId: string;
};

export function AdminBookingDetailView({ bookingId }: Props) {
  const { booking, loading, error, reload } = useAdminBookingDetail(bookingId);
  const { canRunBookingSupportActions } = useAdminPermissions();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SupportAction | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [cancelParty, setCancelParty] = useState<"client" | "vendor">("client");
  const [cancelReason, setCancelReason] = useState("");

  const cancelFormParsed = parseForm(adminCancelBookingSchema, {
    reason: cancelReason,
    onBehalfOf: cancelParty,
  });
  const cancelFormValid = cancelFormParsed.ok;

  const runAction = async (action: SupportAction) => {
    if (action.id === "cancel") {
      if (!cancelFormValid) return;
    }
    setPendingAction(null);
    setFeedback(null);
    setActionBusy(action.id);
    try {
      await action.run();
      await reload();
      setFeedback({
        tone: "success",
        title: "Done",
        message: action.successMessage,
      });
      if (action.id === "cancel") {
        setCancelReason("");
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "Something went wrong",
        message: getApiErrorDetail(err) ?? "That didn't work. Try again.",
      });
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading booking…" rows={3} />;
  }

  if (error || !booking) {
    return <AdminErrorBanner message={error ?? "Not found."} />;
  }

  const lineItems = mapAdminLineItems(asArray(booking.line_items));
  const reviewVendor = asClientReview(booking.review_vendor);
  const pricing = asPricing(booking.pricing);
  const support = asSupport(booking.support);
  const eventName = String(booking.event_name ?? "Booking");
  const quoteTotalLabel = String(booking.total_label ?? booking.client_total_label ?? "—");
  const openDispute = support?.open_dispute;
  const holdActive = Boolean(support?.support_hold);

  const supportActions = buildSupportActions({
    bookingId,
    holdActive,
    cancelParty,
    cancelReason,
  });

  return (
    <div className="w-full space-y-5 text-left">
      <AdminBookingDetailHeader
        eventName={eventName}
        status={String(booking.status ?? "")}
        paymentStatus={String(booking.payment_status ?? "unpaid")}
        holdActive={holdActive}
        support={support}
        openDispute={openDispute}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <AdminBookingDetailMainContent
          booking={booking}
          lineItems={lineItems}
          pricing={pricing}
          quoteTotalLabel={quoteTotalLabel}
          reviewVendor={reviewVendor}
        />

        <AdminBookingSupportActionsPanel
          canRunBookingSupportActions={canRunBookingSupportActions}
          supportActions={supportActions}
          actionBusy={actionBusy}
          pendingAction={pendingAction}
          onPendingActionChange={setPendingAction}
          onRunAction={runAction}
          cancelParty={cancelParty}
          onCancelPartyChange={setCancelParty}
          cancelReason={cancelReason}
          onCancelReasonChange={setCancelReason}
          cancelFormValid={cancelFormValid}
          feedback={feedback}
          onFeedbackClose={() => setFeedback(null)}
        />
      </div>
    </div>
  );
}
