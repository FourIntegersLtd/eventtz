import {
  Ban,
  CheckCircle2,
  CreditCard,
  Pause,
  Play,
  RefreshCw,
  Unlock,
  Wallet,
} from "lucide-react";
import {
  adminCancelBookingOnBehalf,
  adminCompleteBookingCancellation,
  adminConfirmBookingCompletion,
  adminReleaseBookingPayout,
  adminResetBookingCheckout,
  adminRunBookingMaintenance,
  adminSetBookingSupportHold,
  adminSyncBookingPayment,
} from "@/lib/adminPlatformApi";
import type { SupportAction } from "./AdminBookingDetailShared";

type BuildSupportActionsArgs = {
  bookingId: string;
  holdActive: boolean;
  cancelParty: "client" | "vendor";
  cancelReason: string;
};

export function buildSupportActions({
  bookingId,
  holdActive,
  cancelParty,
  cancelReason,
}: BuildSupportActionsArgs): SupportAction[] {
  return [
    {
      id: "sync",
      title: "Check payment",
      tooltipHint: "e.g. client says they paid but booking still shows unpaid",
      confirmBody:
        "Use when the client says money left their account but Eventtz still shows unpaid. We'll find their payment and update the booking.",
      successMessage: "Payment checked — booking updated.",
      icon: CreditCard,
      run: () => adminSyncBookingPayment(bookingId),
    },
    {
      id: "reset",
      title: "Unblock checkout",
      tooltipHint: "e.g. client can't pay — checkout page is stuck or errors",
      confirmBody:
        "Use when the client can't complete payment — for example the pay button errors or spins forever. This lets them try paying again from scratch.",
      successMessage: "Checkout cleared. The client can try paying again.",
      icon: Unlock,
      run: () => adminResetBookingCheckout(bookingId),
    },
    {
      id: "payout",
      title: "Pay vendor",
      tooltipHint: "e.g. event went ahead but vendor hasn't received their money",
      confirmBody:
        "Use when the event happened and everyone is happy, but the vendor's money is still on hold. This sends them what they're owed.",
      successMessage: "Vendor paid.",
      icon: Wallet,
      run: () => adminReleaseBookingPayout(bookingId),
    },
    {
      id: "complete-cancel",
      title: "Finish cancellation",
      tooltipHint: "e.g. client got a refund but booking still looks confirmed",
      confirmBody:
        "Use when the client already received their money back but the booking still shows as active. This closes it out properly.",
      successMessage: "Booking marked as cancelled.",
      icon: RefreshCw,
      run: () => adminCompleteBookingCancellation(bookingId),
    },
    {
      id: "confirm-client",
      title: "Mark complete (client)",
      tooltipHint: "e.g. client emailed to say the event went well but didn't tap complete",
      confirmBody:
        "Use when the client has told you the event went well but forgot to mark it complete in the app. This records it on their behalf.",
      successMessage: "Recorded as complete for the client.",
      icon: CheckCircle2,
      run: () => adminConfirmBookingCompletion(bookingId, { party: "client" }),
    },
    {
      id: "confirm-vendor",
      title: "Mark complete (vendor)",
      tooltipHint: "e.g. vendor says they did the job but didn't tap complete",
      confirmBody:
        "Use when the vendor has confirmed they did the job but didn't mark it complete in the app. This records it on their behalf.",
      successMessage: "Recorded as complete for the vendor.",
      icon: CheckCircle2,
      run: () => adminConfirmBookingCompletion(bookingId, { party: "vendor" }),
    },
    {
      id: "hold",
      title: holdActive ? "Resume payout" : "Pause payout",
      tooltipHint: holdActive
        ? "e.g. you've finished looking into a complaint — OK to pay vendor"
        : "e.g. client complained — hold vendor's money while you investigate",
      confirmBody: holdActive
        ? "Use when you've finished investigating and it's OK for the vendor to be paid automatically again."
        : "Use when someone has raised a problem — for example the client says the vendor didn't show. The vendor won't be paid until you resume payout.",
      successMessage: holdActive ? "Automatic payout resumed." : "Automatic payout paused.",
      icon: holdActive ? Play : Pause,
      run: () => adminSetBookingSupportHold(bookingId, !holdActive),
    },
    {
      id: "maintenance",
      title: "Re-run checks",
      tooltipHint: "e.g. reminder emails didn't go out after the event",
      confirmBody:
        "Use when post-event reminders didn't send or you want the system to check if a payout is running late.",
      successMessage: "Checks completed.",
      icon: RefreshCw,
      run: () => adminRunBookingMaintenance(bookingId),
    },
    {
      id: "cancel",
      title: "Cancel booking",
      tooltipHint: "e.g. client or vendor asked support to cancel",
      confirmBody:
        "Use when the client or vendor has asked you to cancel — for example they can no longer make the date. If they've already paid, they'll get a refund.",
      successMessage: "Booking cancelled.",
      icon: Ban,
      destructive: true,
      run: () =>
        adminCancelBookingOnBehalf(bookingId, {
          party: cancelParty,
          reason: cancelReason.trim(),
        }),
    },
  ];
}

export const VISIBLE_ACTION_COUNT = 4;
