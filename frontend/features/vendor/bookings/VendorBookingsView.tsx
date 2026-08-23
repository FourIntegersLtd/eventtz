"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BackLink } from "@/components/ui/BackLink";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel } from "@/features/bookings/BookingListPanel";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";
import { VendorBookingDetailExtras } from "@/features/vendor/bookings/VendorBookingDetailExtras";
import { VendorBookingResponseFlow } from "@/features/vendor/bookings/VendorBookingResponseFlow";
import { useVendorBookingsController } from "@/features/vendor/bookings/useVendorBookingsController";
import { PayoutSetupRequiredModal } from "@/features/vendor/payments/PayoutSetupRequiredModal";

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
      <MasterDetailLayout
        hasSelection={!!selectedBookingId}
        list={
          <BookingListPanel
            tab={controller.tab}
            onTabChange={controller.setTab}
            rows={controller.rows}
            loading={controller.listLoading}
            error={controller.listError}
            selectedId={selectedBookingId ?? null}
            onSelect={controller.selectBooking}
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[controller.tab]}
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
                booking={controller.viewModel}
                loading={controller.detailLoading || (controller.listLoading && !selectedBookingId)}
                error={controller.detailError}
                actionError={controller.actionError}
                headerActions={controller.headerActions}
                footerActions={controller.footerActions}
                emptyTitle={controller.list.length === 0 ? "No bookings yet" : "Select a booking"}
                slots={{
                  beforeSections: controller.detail ? (
                    <VendorBookingDetailExtras
                      detail={controller.detail}
                      actionBusy={controller.actionBusy}
                      onConfirmComplete={() => controller.setConfirmAction("complete")}
                      onRetryPayout={() => void controller.applyConfirmCompletion()}
                    />
                  ) : undefined,
                  footerSection: controller.showClientResponseFlow && controller.detail ? (
                    <VendorBookingResponseFlow
                      key={`${controller.detail.booking_request_id}-${controller.detail.vendor_adjustments.length}`}
                      detail={controller.detail}
                      actionBusy={controller.actionBusy}
                      adjustmentSaving={controller.adjustmentSaving}
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
