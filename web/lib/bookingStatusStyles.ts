import type { Tone } from "@/lib/tone";

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

/** Badge tone for a payment status (independent of booking `status`). */
export function paymentStatusTone(paymentStatus: string): Tone {
  switch (paymentStatus) {
    // "unpaid" is intentionally neutral (falls to default): nothing has happened yet.
    case "pending":
      return "warning";
    case "paid":
      return "success";
    case "payout_released":
      return "info";
    case "refunded":
    case "partially_refunded":
      return "danger";
    default:
      return "neutral";
  }
}
