"use client";

import { Button } from "@/foundation/ui";
import { clientBookingActions } from "@/domains/client-bookings/bookingActions";
import type { ClientBookingAction } from "@/domains/client-bookings/useClientBookingDetail";
import type { ClientBookingDetail } from "@/domains/client-bookings/api";

/**
 * The status-changing buttons for one client booking, chosen from its current
 * `booking_status`/`initiator`/`payment_status` via `clientBookingActions` —
 * which mirrors the server's own transition rules, so a hidden action here is
 * one the API would reject anyway, not just a UI guess. Labels match the
 * baseline's `useClientBookingsController`. Declining, cancelling and
 * confirming completion only open a confirmation; the caller runs the action.
 * Price-update answers live on `PriceUpdateBanner` instead.
 */
export function BookingStatusActions({
  booking,
  pendingAction,
  onAcceptQuote,
  onDeclineQuote,
  onCancel,
  onConfirmCompletion,
}: {
  booking: ClientBookingDetail;
  pendingAction: ClientBookingAction | null;
  onAcceptQuote: () => void;
  onDeclineQuote: () => void;
  onCancel: () => void;
  onConfirmCompletion: () => void;
}) {
  const actions = clientBookingActions(booking);
  const busy = pendingAction !== null;

  if (actions.canRespondToQuote) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button loading={pendingAction === "acceptQuote"} disabled={busy} onClick={onAcceptQuote}>
          {pendingAction === "acceptQuote" ? "Accepting…" : "Accept quote"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onDeclineQuote}>
          Decline
        </Button>
      </div>
    );
  }

  if (!actions.canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.canConfirmCompletion ? (
        <Button disabled={busy} onClick={onConfirmCompletion}>
          Confirm event complete
        </Button>
      ) : null}
      <Button variant="secondary" disabled={busy} onClick={onCancel}>
        Cancel booking
      </Button>
    </div>
  );
}
