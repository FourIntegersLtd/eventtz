"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BackLink } from "@/components/ui/BackLink";
import { ClientBookingReviewForm } from "@/features/client/bookings/ClientBookingReviewForm";
import { ClientBookingDetailExtras } from "@/features/client/bookings/ClientBookingDetailExtras";
import { useClientBookingsController } from "@/features/client/bookings/useClientBookingsController";
import { BookingDisputeSection } from "@/features/bookings/BookingDisputeSection";
import { BookingDetailPanel } from "@/features/bookings/BookingDetailPanel";
import { BookingListPanel } from "@/features/bookings/BookingListPanel";
import { MasterDetailLayout } from "@/features/bookings/MasterDetailLayout";
import { BOOKING_EMPTY_LIST_TITLE } from "@/features/bookings/bookingListConstants";
import { BOOKING_CONFIRM_COPY } from "@/features/bookings/bookingConfirmCopy";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { BookingReviewPanel } from "@/features/reviews/BookingReviewPanel";

type ClientBookingsViewProps = {
  /** Present on `/client/bookings/[bookingId]` — absent on the `/client/bookings` index. */
  selectedBookingId?: string;
};

export function ClientBookingsView({ selectedBookingId }: ClientBookingsViewProps) {
  const c = useClientBookingsController({ selectedBookingId });

  return (
    <>
      <ConfirmDialog
        isOpen={c.cancelOpen}
        title={c.clientCancelCopy.title}
        description={c.clientCancelCopy.description}
        cancelLabel={c.clientCancelCopy.cancelLabel}
        confirmLabel={c.clientCancelCopy.confirmLabel}
        confirmLoadingLabel={c.clientCancelCopy.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={c.actionBusy}
        onCancel={() => c.setCancelOpen(false)}
        onConfirm={() => void c.confirmCancelBooking()}
      />

      <ConfirmDialog
        isOpen={c.confirmCompleteOpen}
        title={BOOKING_CONFIRM_COPY.confirmComplete.title}
        description={BOOKING_CONFIRM_COPY.confirmComplete.description}
        confirmLabel={BOOKING_CONFIRM_COPY.confirmComplete.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.confirmComplete.confirmLoadingLabel}
        confirmVariant="primary"
        loading={c.confirmingCompletion}
        onCancel={() => c.setConfirmCompleteOpen(false)}
        onConfirm={() => void c.confirmCompletion()}
      />

      <ConfirmDialog
        isOpen={c.declineQuoteOpen}
        title={BOOKING_CONFIRM_COPY.declineQuote.title}
        description={BOOKING_CONFIRM_COPY.declineQuote.description}
        cancelLabel={BOOKING_CONFIRM_COPY.declineQuote.cancelLabel}
        confirmLabel={BOOKING_CONFIRM_COPY.declineQuote.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.declineQuote.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={c.actionBusy && c.pendingQuoteAction === "decline"}
        onCancel={() => c.setDeclineQuoteOpen(false)}
        onConfirm={() => {
          c.setDeclineQuoteOpen(false);
          void c.applyClientQuoteResponse("declined");
        }}
      />

      <ConfirmDialog
        isOpen={c.declinePriceOpen}
        title={BOOKING_CONFIRM_COPY.declineUpdatedPrice.title}
        description={BOOKING_CONFIRM_COPY.declineUpdatedPrice.description}
        cancelLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.cancelLabel}
        confirmLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.confirmLabel}
        confirmLoadingLabel={BOOKING_CONFIRM_COPY.declineUpdatedPrice.confirmLoadingLabel}
        confirmVariant="destructive"
        loading={c.actionBusy && c.pendingPriceAction === "decline"}
        onCancel={() => c.setDeclinePriceOpen(false)}
        onConfirm={() => {
          c.setDeclinePriceOpen(false);
          void c.applyClientUpdatedPriceResponse("declined");
        }}
      />

      {c.detail ? (
        <ChatDrawer
          isOpen={c.chatOpen}
          onClose={() => c.setChatOpen(false)}
          portal="client"
          counterpartyName={c.detail.vendor_display_name}
          conversationId={c.detail.conversation_id}
          counterpartyUserId={c.detail.vendor_user_id}
          onConversationCreated={(conversationId) => {
            c.setDetail((d) =>
              d && d.id === c.detail!.id ? { ...d, conversation_id: conversationId } : d,
            );
          }}
        />
      ) : null}

      <MasterDetailLayout
        hasSelection={!!selectedBookingId}
        list={
          <BookingListPanel
            tab={c.tab}
            onTabChange={c.setTab}
            rows={c.rows}
            loading={c.listLoading}
            error={c.listError}
            selectedId={selectedBookingId ?? null}
            onSelect={c.selectBooking}
            emptyTitle={BOOKING_EMPTY_LIST_TITLE[c.tab]}
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
                booking={c.viewModel}
                loading={c.detailLoading}
                error={c.detailError}
                actionError={c.actionError}
                headerActions={c.headerActions}
                footerActions={c.footerActions}
                emptyTitle={c.list.length === 0 ? "No bookings yet" : "Select a booking"}
                slots={{
                  beforeSections: c.detail ? (
                    <ClientBookingDetailExtras
                      detail={c.detail}
                      showUpdatedPriceBanner={c.showUpdatedPriceBanner}
                      showCheckoutReturnBanner={c.showCheckoutReturnBanner}
                      checkoutReturnMessage={c.checkoutReturnMessage}
                      paymentBanner={c.paymentBanner}
                      paymentSyncError={c.paymentSyncError}
                      showCancelledRefunded={c.showCancelledRefunded}
                      paymentDue={c.paymentDue}
                      paymentBannerRef={c.paymentBannerRef}
                      actionBusy={c.actionBusy}
                      confirmingCompletion={c.confirmingCompletion}
                      pendingPriceAction={c.pendingPriceAction}
                      onAcceptUpdatedPrice={() => void c.applyClientUpdatedPriceResponse("accepted")}
                      onDeclineUpdatedPrice={() => c.setDeclinePriceOpen(true)}
                      onConfirmComplete={() => c.setConfirmCompleteOpen(true)}
                      onPayNow={c.payNow}
                    />
                  ) : undefined,
                  afterSections:
                    c.detail && c.detail.status === "completed" ? (
                      c.detail.review ? (
                        <BookingReviewPanel
                          title="Your review"
                          review={c.detail.review}
                          variant="amber"
                          emptyLabel="No review yet."
                        />
                      ) : (
                        <ClientBookingReviewForm
                          bookingId={c.detail.id}
                          vendorName={c.detail.vendor_display_name}
                          initialRating={c.deepLinkRating}
                          onSubmitted={(rev) => {
                            c.setDetail((d) =>
                              d && d.id === c.detail!.id ? { ...d, review: rev } : d,
                            );
                          }}
                        />
                      )
                    ) : undefined,
                  disputeSection: c.detail ? (
                    <BookingDisputeSection
                      bookingId={c.detail.id}
                      role="client"
                      bookingStatus={c.detail.status}
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
