"use client";

import { Button } from "@/foundation/ui";
import type { VendorBookingAction } from "@/domains/vendor-bookings/useVendorBookingDetail";
import type { VendorBookingDetail } from "@/domains/vendor-bookings/api";

/**
 * The status-changing buttons for one booking, chosen from its current
 * `booking_status`/`initiator`/`payment_status` — mirrors the server's own
 * transition rules (`patch_vendor_booking_status`) so a disabled action here
 * is one the API would reject anyway, not just a UI guess.
 */
export function BookingStatusActions({
  booking,
  pendingAction,
  onAccept,
  onDecline,
  onWithdraw,
  onCancel,
  onConfirmCompletion,
}: {
  booking: VendorBookingDetail;
  pendingAction: VendorBookingAction | null;
  onAccept: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
  onCancel: () => void;
  onConfirmCompletion: () => void;
}) {
  const busy = pendingAction !== null;

  if (booking.booking_status === "pending" && booking.initiator === "vendor") {
    return (
      <Button variant="secondary" loading={pendingAction === "withdraw"} disabled={busy && pendingAction !== "withdraw"} onClick={onWithdraw}>
        Withdraw quote
      </Button>
    );
  }

  if (booking.booking_status === "pending" || booking.booking_status === "declined") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button loading={pendingAction === "accept"} disabled={busy && pendingAction !== "accept"} onClick={onAccept}>
          Accept
        </Button>
        {booking.booking_status === "pending" ? (
          <Button
            variant="secondary"
            loading={pendingAction === "decline"}
            disabled={busy && pendingAction !== "decline"}
            onClick={onDecline}
          >
            Decline
          </Button>
        ) : null}
      </div>
    );
  }

  if (booking.booking_status === "accepted") {
    const canConfirmCompletion = booking.payment_status === "paid" && !booking.vendor_completion_confirmed_at;
    return (
      <div className="flex flex-wrap gap-2">
        {canConfirmCompletion ? (
          <Button loading={pendingAction === "complete"} disabled={busy && pendingAction !== "complete"} onClick={onConfirmCompletion}>
            Confirm the event went ahead
          </Button>
        ) : null}
        <Button variant="secondary" loading={pendingAction === "cancel"} disabled={busy && pendingAction !== "cancel"} onClick={onCancel}>
          Cancel booking
        </Button>
      </div>
    );
  }

  return null;
}
