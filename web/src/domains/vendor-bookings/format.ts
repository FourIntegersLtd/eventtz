/**
 * Display-only formatters for the vendor bookings domain.
 *
 * The booking endpoints return money as GBP-pound numbers (`amount_gbp`,
 * `total_label`, …), unlike the pence-integer convention elsewhere on the
 * API (AGENTS.md) — this slice mirrors the baseline's `amount_gbp` fields
 * byte-for-byte. Wherever the API already supplies a formatted `*_label`
 * string, components render that directly instead of re-deriving it; this
 * file only formats values the vendor edits (adjustment amounts) or that
 * have no server-provided label.
 */

/** Formats a GBP-pound amount as `£1,234.56` (or `-£50.00` for a discount). */
export function formatGbp(amountGbp: number): string {
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Math.abs(amountGbp));
  return amountGbp < 0 ? `-${formatted}` : formatted;
}

/** Formats an ISO date (or datetime) string for a person, e.g. "12 Jun 2026". */
export function formatEventDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date to be confirmed";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

const BOOKING_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

/** A human label for `booking_status`; falls back to the raw code for one the frontend doesn't know yet. */
export function bookingStatusLabel(bookingStatus: string): string {
  return BOOKING_STATUS_LABELS[bookingStatus] ?? bookingStatus;
}

const PAYMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  payout_released: "Payout released",
};

/** A human label for `payment_status`; falls back to the raw code for one the frontend doesn't know yet. */
export function paymentStatusLabel(paymentStatus: string): string {
  return PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus;
}

/** Who sent this booking: the client asking a vendor to quote, or the vendor quoting first. */
export function initiatorLabel(initiator: "client" | "vendor"): string {
  return initiator === "vendor" ? "Your quote" : "Client enquiry";
}

const DISPUTE_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

/** A human label for a dispute's `status`; falls back to the raw code for one the frontend doesn't know yet. */
export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}
