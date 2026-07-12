/** Background + text classes for booking request status badges. */

export function bookingStatusToneClasses(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-950";
    case "accepted":
      return "bg-emerald-100 text-emerald-900";
    case "completed":
      return "bg-sky-100 text-sky-950";
    case "declined":
      return "bg-red-100 text-red-900";
    case "cancelled":
      return "bg-slate-200 text-slate-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

/**
 * Payment lifecycle badge (independent of booking `status`):
 * unpaid -> pending -> paid -> payout_released, or refunded/partially_refunded via disputes.
 */
export function paymentStatusLabel(paymentStatus: string): string {
  switch (paymentStatus) {
    case "unpaid":
      return "Unpaid";
    case "pending":
      return "Processing payment";
    case "paid":
      return "Paid";
    case "payout_released":
      return "Paid out";
    case "refunded":
      return "Refunded";
    case "partially_refunded":
      return "Partially refunded";
    default:
      return paymentStatus;
  }
}

export function paymentStatusToneClasses(paymentStatus: string): string {
  switch (paymentStatus) {
    case "unpaid":
      return "bg-neutral-100 text-neutral-700";
    case "pending":
      return "bg-amber-100 text-amber-950";
    case "paid":
      return "bg-emerald-100 text-emerald-900";
    case "payout_released":
      return "bg-sky-100 text-sky-950";
    case "refunded":
    case "partially_refunded":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}
