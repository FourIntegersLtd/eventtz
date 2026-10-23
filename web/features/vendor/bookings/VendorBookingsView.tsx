"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { VendorBookingDetailEzPanel } from "@/features/bookings/VendorBookingDetailEzPanel";
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import { VendorBookingDetailExtras } from "@/features/vendor/bookings/VendorBookingDetailExtras";
import { VendorBookingResponseFlow } from "@/features/vendor/bookings/VendorBookingResponseFlow";
import { useVendorBookingsController } from "@/features/vendor/bookings/useVendorBookingsController";
import { PayoutSetupRequiredModal } from "@/features/vendor/payments/PayoutSetupRequiredModal";
import { VendorBookingsEzList } from "@/features/vendor/bookings/VendorBookingsEzList";
import { BookingDateChangeCard, dateChangeIsVisible } from "@/features/bookings/BookingDateChangeCard";
import { paymentDeadlineLine } from "@/features/bookings/bookingTerms";
import type { VendorBookingDetail } from "@/lib/vendorBookingsApi";

/** Payment deadline and date-change controls for the right-hand action card. */
function vendorSideActions(detail: VendorBookingDetail) {
  const deadline = paymentDeadlineLine("vendor", detail.payment_due_at, detail.payment_status);
  const dateChange = vendorDateChangeAction(detail);
  if (!deadline && !dateChange) return undefined;
  return (
    <>
      {deadline ? <p className="ez-small">{deadline}</p> : null}
      {dateChange}
    </>
  );
}

/** Date-change control for the right-hand action card. Hidden when a change is not allowed. */
function vendorDateChangeAction(detail: VendorBookingDetail) {
  const dateChange = detail;
  if (
    !dateChangeIsVisible(
      detail.booking_status,
      detail.payment_status,
      dateChange.date_change_requested_by,
    )
  ) {
    return undefined;
  }
  return (
    <BookingDateChangeCard
      role="vendor"
      bookingId={detail.booking_request_id}
      bookingStatus={detail.booking_status}
      paymentStatus={detail.payment_status}
      eventDate={detail.event_date}
      eventEndDate={detail.event_end_date}
      dateChange={dateChange}
      requestPresentation="modal"
    />
  );
}

type VendorBookingsViewProps = {
  /** Present on `/vendor/bookings/[bookingId]` - absent on the `/vendor/bookings` index. */
  selectedBookingId?: string;
};

export function VendorBookingsView({ selectedBookingId }: VendorBookingsViewProps) {
  const controller = useVendorBookingsController({ selectedBookingId });

  return (
    <>
      <PayoutSetupRequiredModal
        isOpen={controller.payoutModalOpen}
        connecting={controller.connectingPayouts}
        error={controller.payoutConnectError}
        clientName={controller.detail?.client_email ?? undefined}
        onClose={() => {
          controller.setPayoutModalOpen(false);
          controller.setPayoutConnectError(null);
        }}
        onCompleteSetup={controller.onCompletePayoutSetup}
      />
      {controller.confirmAction ? (
        <ConfirmDialog
          isOpen
          title={controller.confirmCopy[controller.confirmAction].title}
          description={controller.confirmCopy[controller.confirmAction].description}
          cancelLabel={controller.confirmCopy[controller.confirmAction].cancelLabel ?? "Go back"}
          confirmLabel={controller.confirmCopy[controller.confirmAction].confirmLabel}
          confirmLoadingLabel={controller.confirmCopy[controller.confirmAction].loadingLabel}
          confirmVariant={controller.confirmCopy[controller.confirmAction].variant}
          lottie={controller.confirmAction === "complete" ? "successCheck" : "failure"}
          loading={controller.actionBusy}
          onCancel={() => controller.setConfirmAction(null)}
          onConfirm={controller.handleConfirmAction}
        />
      ) : null}
      {controller.detail ? (
        <ChatDrawer
          isOpen={controller.chatOpen}
          onClose={() => {
            controller.setChatOpen(false);
            controller.setChatPrefill(null);
          }}
          initialDraft={controller.chatPrefill}
          portal="vendor"
          counterpartyName={controller.detail.client_email ?? "this client"}
          conversationId={controller.detail.conversation_id}
          counterpartyUserId={controller.detail.client_user_id ?? undefined}
          onConversationCreated={(conversationId) => {
            controller.setDetail((d) =>
              d && d.booking_request_id === controller.detail!.booking_request_id ? { ...d, conversation_id: conversationId } : d,
            );
          }}
        />
      ) : null}
      {selectedBookingId ? (
        <VendorBookingDetailEzPanel
          booking={controller.viewModel}
          loading={controller.detailLoading}
          error={controller.detailError}
          actionError={controller.actionError}
          headerActions={controller.headerActions}
          footerActions={controller.footerActions}
          emptyTitle="Booking not found"
          slots={{
            beforeSections: controller.detail ? (
              <VendorBookingDetailExtras
                detail={controller.detail}
                actionBusy={controller.actionBusy}
                onConfirmComplete={() => controller.setConfirmAction("complete")}
                onRetryPayout={() => void controller.applyConfirmCompletion()}
                onDetailChanged={controller.reloadBookingDetail}
              />
            ) : undefined,
            sideActions: controller.detail ? vendorSideActions(controller.detail) : undefined,
            footerSection: controller.showClientResponseFlow && controller.detail ? (
              <VendorBookingResponseFlow
                key={`${controller.detail.booking_request_id}-${controller.detail.vendor_adjustments.length}`}
                detail={controller.detail}
                actionBusy={controller.actionBusy}
                adjustmentSaving={controller.adjustmentSaving}
                payoutsLoading={controller.payoutsLoading}
                payoutsReady={controller.payoutsReady}
                onPayoutSetupRequired={() => controller.setPayoutModalOpen(true)}
                onAcceptAtListedPrice={() => controller.requestAccept()}
                onDecline={() => void controller.applyBookingStatus("declined")}
                onSendUpdatedPrice={(rows) => void controller.sendUpdatedPrice(rows)}
                onOpenChat={() => controller.setChatOpen(true)}
                onUseDraftInChat={(message) => controller.setChatPrefill(message)}
              />
            ) : undefined,
            afterSections:
              controller.detail && controller.detail.booking_status === "completed" ? (
                <BookingReviewPanel
                  title="Client review"
                  review={controller.detail.review}
                  showReviewer
                  emptyLabel="The client has not left a review for this booking yet."
                />
              ) : undefined,
            disputeSection: controller.detail ? (
              <BookingDisputeSection
                bookingId={controller.detail.booking_request_id}
                role="vendor"
                bookingStatus={controller.detail.booking_status}
                presentation="header"
              />
            ) : (
              <></>
            ),
          }}
        />
      ) : (
        <VendorBookingsEzList
          tab={controller.tab}
          onTabChange={controller.setTab}
          rows={controller.rows}
          loading={controller.listLoading}
          error={controller.listError}
          emptyTitle={BOOKING_EMPTY_LIST_TITLE[controller.tab]}
          listOffset={controller.listOffset}
          listPageSize={controller.listPageSize}
          listTotal={controller.listTotal}
          onListPrevious={() =>
            controller.setListOffset(Math.max(0, controller.listOffset - controller.listPageSize))
          }
          onListNext={() => controller.setListOffset(controller.listOffset + controller.listPageSize)}
          listSearch={controller.listSearch}
          onListSearchChange={controller.setListSearch}
        />
      )}
    </>
  );
}
