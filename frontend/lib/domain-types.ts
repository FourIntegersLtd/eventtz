export type UserType = "client" | "vendor" | "admin";

export type VendorApprovalStatus = "pending" | "approved" | "banned";

export type VendorProfileStatus = "draft" | "submitted" | "complete";

// ---------------------------------------------------------------------------
// Booking domain — shared between client and vendor portals so status colors,
// labels, and cross-role shapes are defined exactly once. See cursor.md /
// the "Signed-in UX overhaul" plan for why this file, not each *BookingsApi,
// owns this vocabulary.
// ---------------------------------------------------------------------------

/** Who initiated the booking: the client requested it, or the vendor sent a quote. */
export type BookingInitiator = "client" | "vendor";

export type VendorAdjustmentItem = {
  id: string;
  tag: string;
  label: string;
  amount_gbp: number;
};

export type BookingPricingBreakdown = {
  line_items_subtotal_gbp: number;
  vendor_adjustments: VendorAdjustmentItem[];
  adjustments_total_gbp: number;
  vendor_portion_gbp: number;
  service_fee_percent: number;
  service_fee_gbp: number;
  client_total_gbp: number;
  has_pricing_tbc: boolean;
  vendor_portion_label: string;
  service_fee_label: string;
  client_total_label: string;
  line_items_subtotal_label: string;
};

/**
 * Every status a booking can be in, across both portals. Server responses
 * type `status` as `string` (it's the source of truth), but every UI surface
 * should narrow through this union via `toBookingStatus` so unrecognized
 * values fail safe instead of silently rendering as unstyled text.
 *
 * "disputed" is not a raw booking status the backend returns — a booking
 * keeps its underlying status (pending/accepted/completed) while a dispute
 * is open against it (see `bookingDisputeHelpers.ts`). View-model mappers
 * that combine booking + dispute state use this entry to badge that
 * combined state consistently; `toBookingStatus` never produces it from a
 * raw booking `status` field.
 */
export type BookingStatus =
  | "pending"
  | "accepted"
  | "completed"
  | "declined"
  | "cancelled"
  | "disputed";

export type BookingStatusMeta = {
  status: BookingStatus;
  /** Short label for badges, filters, and list rows. */
  label: string;
  /** Longer label for status headers on the detail page. */
  headline: string;
  /** Tailwind classes for the StatusBadge pill — the only place status color is declared. */
  badgeClassName: string;
  /** Which top-level attention group this status belongs to for dashboards/filters. */
  group: "needsAction" | "upcoming" | "completed" | "closed";
};

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  pending: {
    status: "pending",
    label: "Pending",
    headline: "Awaiting response",
    badgeClassName: "bg-amber-100 text-amber-800",
    group: "needsAction",
  },
  accepted: {
    status: "accepted",
    label: "Accepted",
    headline: "Accepted",
    badgeClassName: "bg-emerald-100 text-emerald-800",
    group: "upcoming",
  },
  completed: {
    status: "completed",
    label: "Completed",
    headline: "Completed",
    badgeClassName: "bg-blue-100 text-blue-800",
    group: "completed",
  },
  declined: {
    status: "declined",
    label: "Declined",
    headline: "Declined",
    badgeClassName: "bg-neutral-200 text-neutral-700",
    group: "closed",
  },
  cancelled: {
    status: "cancelled",
    label: "Cancelled",
    headline: "Cancelled",
    badgeClassName: "bg-neutral-200 text-neutral-700",
    group: "closed",
  },
  disputed: {
    status: "disputed",
    label: "Disputed",
    headline: "Under dispute",
    badgeClassName: "bg-rose-100 text-rose-800",
    group: "closed",
  },
};

const KNOWN_BOOKING_STATUSES = new Set<string>(Object.keys(BOOKING_STATUS_META));

/** Narrow a raw server status string into the known union, defaulting to "pending" if unrecognized. */
export function toBookingStatus(raw: string): BookingStatus {
  return KNOWN_BOOKING_STATUSES.has(raw) ? (raw as BookingStatus) : "pending";
}

export function getBookingStatusMeta(raw: string): BookingStatusMeta {
  return BOOKING_STATUS_META[toBookingStatus(raw)];
}
