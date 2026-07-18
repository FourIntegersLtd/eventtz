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
  /** Present on `/vendor/bookings/[bookingId]` — absent on the `/vendor/bookings` index. */
  selectedBookingId?: string;
};

export function VendorBookingsView({ selectedBookingId }: VendorBookingsViewProps) {
  const v = useVendorBookingsController({ selectedBookingId });

  return (
    <>
      <PayoutSetupRequiredModal
        isOpen={v.payoutModalOpen}
        connecting={v.connectingPayouts}
        error={v.payoutConnectError}
        onClose={() => {
          v.setPayoutModalOpen(false);
          v.setPayoutConnectError(null);
        }}
        onCompleteSetup={v.onCompletePayoutSetup}
      />
      {v.confirmAction ? (
        <ConfirmDialog
          isOpen
          title={v.confirmCopy[v.confirmAction].title}
          description={v.confirmCopy[v.confirmAction].description}
          cancelLabel={v.confirmCopy[v.confirmAction].cancelLabel}
          confirmLabel={v.confirmCopy[v.confirmAction].confirmLabel}
          confirmLoadingLabel={v.confirmCopy[v.confirmAction].loadingLabel}
          confirmVariant={v.confirmCopy[v.confirmAction].variant}
          loading={v.actionBusy}
          onCancel={() => v.setConfirmAction(null)}
          onConfirm={v.handleConfirmAction}
        />
      ) : null}
      {v.detail ? (
        <ChatDrawer
          isOpen={v.chatOpen}
          onClose={() => v.setChatOpen(false)}
          portal="vendor"
          counterpartyName={v.detail.client_email ?? "this client"}
          conversationId={v.detail.conversation_id}
          counterpartyUserId={v.detail.client_user_id ?? undefined}
          onConversationCreated={(conversationId) => {
            v.setDetail((d) =>
              d && d.id === v.detail!.id ? { ...d, conversation_id: conversationId } : d,
            );
          }}
        />
      ) : null}
      <MasterDetailLayout
        hasSelection={!!selectedBookingId}
        list={
          <BookingListPanel
            tab={v.tab}
            onTabChange={v.setTab}
            rows={v.rows}
            loading={v.listLoading}
            error={v.listError}
            selectedId={selectedBookingId ?? null}
            onSelect={v.selectBooking}
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[v.tab]}
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
                booking={v.viewModel}
                loading={v.detailLoading}
                error={v.detailError}
                actionError={v.actionError}
                headerActions={v.headerActions}
                footerActions={v.footerActions}
                emptyTitle={v.list.length === 0 ? "No bookings yet" : "Select a booking"}
                slots={{
                  beforeSections: v.detail ? (
                    <VendorBookingDetailExtras
                      detail={v.detail}
                      actionBusy={v.actionBusy}
                      onConfirmComplete={() => v.setConfirmAction("complete")}
                    />
                  ) : undefined,
                  footerSection: v.showClientResponseFlow && v.detail ? (
                    <VendorBookingResponseFlow
                      key={`${v.detail.id}-${v.detail.vendor_adjustments.length}`}
                      detail={v.detail}
                      actionBusy={v.actionBusy}
                      adjSaving={v.adjSaving}
                      onAcceptAtListedPrice={() => v.requestAccept()}
                      onDecline={() => void v.applyBookingStatus("declined")}
                      onSendUpdatedPrice={(rows) => void v.sendUpdatedPrice(rows)}
                      onOpenChat={() => v.setChatOpen(true)}
                    />
                  ) : undefined,
                  afterSections:
                    v.detail && v.detail.status === "completed" ? (
                      <BookingReviewPanel
                        title="Client review"
                        review={v.detail.review}
                        showReviewer
                        emptyLabel="The client has not left a review for this booking yet."
                      />
                    ) : undefined,
                  disputeSection: v.detail ? (
                    <BookingDisputeSection
                      bookingId={v.detail.id}
                      role="vendor"
                      bookingStatus={v.detail.status}
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
