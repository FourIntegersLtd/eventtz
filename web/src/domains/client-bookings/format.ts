/**
 * Display-only formatters for the client bookings domain.
 *
 * The booking endpoints return money as GBP-pound numbers (`amount_gbp`,
 * `*_label`), unlike the pence-integer convention elsewhere — this mirrors
 * the baseline's `amount_gbp` fields. Where the API already supplies a
 * formatted `*_label` string, components render that directly; these helpers
 * only format values the client edits or that have no server-provided label.
 */

/** Formats a GBP-pound amount as `£1,234.56` (or `-£50.00` for a discount). */
export function formatGbp(amountGbp: number): string {
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Math.abs(amountGbp));
  return amountGbp < 0 ? `-${formatted}` : formatted;
}

/** Formats a GBP-pound amount with 0–2 fraction digits, e.g. `£630` / `£49.5`. */
export function formatMoneyLabel(amountGbp: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountGbp);
}

/** Formats a `YYYY-MM-DD` event date as "Sun, 12 Jul 2026"; noon UTC avoids DST drift. */
export function formatEventDate(isoDate: string | null | undefined): string {
  if (!isoDate || isoDate.length < 10) return isoDate ?? "";
  const parsed = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats a full ISO timestamp as "12 Jul 2026, 14:03"; `-` when absent. */
export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "-";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const BOOKING_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** A human label for `booking_status`; falls back to the raw code. */
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

/** A human label for `payment_status`; falls back to the raw code. */
export function paymentStatusLabel(paymentStatus: string): string {
  return PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus;
}

/** The badge a client sees when a vendor initiated the request first. */
export function clientInitiatorBadgeLabel(initiator: "client" | "vendor"): string | null {
  return initiator === "vendor" ? "Vendor quote" : null;
}
