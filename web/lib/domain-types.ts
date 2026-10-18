import type { Tone } from "@/lib/tone";

export type UserType = "client" | "vendor" | "admin";

export type VendorApprovalStatus = "pending" | "approved" | "banned";

export type VendorProfileStatus = "draft" | "submitted" | "complete";

export type VendorApprovalStatusMeta = {
  status: VendorApprovalStatus;
  label: string;
  tone: Tone;
};

export type VendorProfileStatusMeta = {
  status: VendorProfileStatus;
  label: string;
  tone: Tone;
};

/**
 * Stripe Connect readiness. Marketplace visibility needs admin approval AND
 * "verified" here, so an approved vendor stays hidden while this is "unverified".
 */
export type VendorPayoutStatus = "verified" | "unverified";

export type VendorPayoutStatusMeta = {
  status: VendorPayoutStatus;
  label: string;
  tone: Tone;
};

/**
 * Admin override on top of the automatic visibility rule. "visible" waives the
 * Stripe payout requirement for a vendor vetted another way; "hidden" takes a
 * listing down without the lock-out of a ban. Approval still wins over both.
 */
export type VendorListingOverride = "auto" | "visible" | "hidden";

export type VendorListingOverrideMeta = {
  override: VendorListingOverride;
  label: string;
  description: string;
  badgeClassName: string;
};

export const VENDOR_APPROVAL_STATUS_META: Record<VendorApprovalStatus, VendorApprovalStatusMeta> = {
  pending: {
    status: "pending",
    label: "Pending",
    tone: "warning",
  },
  approved: {
    status: "approved",
    label: "Approved",
    tone: "success",
  },
  banned: {
    status: "banned",
    label: "Banned",
    tone: "danger",
  },
};

export const VENDOR_PROFILE_STATUS_META: Record<VendorProfileStatus, VendorProfileStatusMeta> = {
  draft: {
    status: "draft",
    label: "Draft",
    tone: "neutral",
  },
  submitted: {
    status: "submitted",
    label: "Submitted",
    tone: "info",
  },
  complete: {
    status: "complete",
    label: "Complete",
    tone: "success",
  },
};

export const VENDOR_PAYOUT_STATUS_META: Record<VendorPayoutStatus, VendorPayoutStatusMeta> = {
  verified: {
    status: "verified",
    label: "Verified",
    tone: "success",
  },
  unverified: {
    status: "unverified",
    label: "Not verified",
    tone: "warning",
  },
};

export const VENDOR_LISTING_OVERRIDE_META: Record<
  VendorListingOverride,
  VendorListingOverrideMeta
> = {
  auto: {
    override: "auto",
    label: "Automatic",
    description: "Stripe decides when they go live.",
    badgeClassName: "bg-neutral-100 text-neutral-700",
  },
  visible: {
    override: "visible",
    label: "Publish anyway",
    description: "Skip Stripe; clients can find, book, and pay.",
    badgeClassName: "bg-sky-100 text-sky-900",
  },
  hidden: {
    override: "hidden",
    label: "Hide listing",
    description: "Off the marketplace; the vendor keeps portal access.",
    badgeClassName: "bg-red-100 text-red-900",
  },
};

const KNOWN_VENDOR_APPROVAL = new Set<string>(Object.keys(VENDOR_APPROVAL_STATUS_META));
const KNOWN_LISTING_OVERRIDE = new Set<string>(Object.keys(VENDOR_LISTING_OVERRIDE_META));
const KNOWN_VENDOR_PROFILE = new Set<string>(Object.keys(VENDOR_PROFILE_STATUS_META));

export function getVendorApprovalStatusMeta(raw: string): VendorApprovalStatusMeta {
  const status = KNOWN_VENDOR_APPROVAL.has(raw) ? (raw as VendorApprovalStatus) : "pending";
  return VENDOR_APPROVAL_STATUS_META[status];
}

export function getVendorProfileStatusMeta(raw: string): VendorProfileStatusMeta {
  const status = KNOWN_VENDOR_PROFILE.has(raw) ? (raw as VendorProfileStatus) : "draft";
  return VENDOR_PROFILE_STATUS_META[status];
}

export function getVendorPayoutStatusMeta(verified: boolean | undefined): VendorPayoutStatusMeta {
  return VENDOR_PAYOUT_STATUS_META[verified ? "verified" : "unverified"];
}

export function getVendorListingOverride(raw: string | undefined): VendorListingOverride {
  return raw && KNOWN_LISTING_OVERRIDE.has(raw) ? (raw as VendorListingOverride) : "auto";
}

export function getVendorListingOverrideMeta(raw: string | undefined): VendorListingOverrideMeta {
  return VENDOR_LISTING_OVERRIDE_META[getVendorListingOverride(raw)];
}

// ---------------------------------------------------------------------------
// Booking domain - shared between client and vendor portals so status colors,
// labels, and cross-role shapes are defined exactly once. See docs/domain-rules.md /
// the "Signed-in UX overhaul" plan for why this file, not each *BookingsApi,
// owns this vocabulary.
// ---------------------------------------------------------------------------

/** Who initiated the booking: the client requested it, or the vendor sent a quote. */
export type BookingInitiator = "client" | "vendor";

export type VendorAdjustmentItem = {
  id: string;
  adjustment_category: string;
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
  service_fee_before_discount_gbp?: number | null;
  service_fee_before_discount_label?: string | null;
  referral_fee_discount_gbp?: number;
  referral_fee_discount_label?: string | null;
  client_total_gbp: number;
  has_pricing_tbc: boolean;
  vendor_portion_label: string;
  service_fee_label: string;
  client_total_label: string;
  line_items_subtotal_label: string;
  vendor_referral_code?: string | null;
  referral_fee_applied?: boolean;
};

/** UI alias — same shape as API `BookingPricingBreakdown`. */
export type BookingPricing = BookingPricingBreakdown;

/**
 * Every status a booking can be in, across both portals. Server responses
 * type `status` as `string` (it's the source of truth), but every UI surface
 * should narrow through this union via `toBookingStatus` so unrecognized
 * values fail safe instead of silently rendering as unstyled text.
 *
 * "disputed" is not a raw booking status the backend returns - a booking
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
  /** Semantic tone for the StatusBadge pill - the only place status color is declared. */
  tone: Tone;
  /** Which top-level attention group this status belongs to for dashboards/filters. */
  group: "needsAction" | "upcoming" | "completed" | "closed";
};

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  pending: {
    status: "pending",
    label: "Pending",
    headline: "Awaiting response",
    tone: "warning",
    group: "needsAction",
  },
  accepted: {
    status: "accepted",
    label: "Accepted",
    headline: "Accepted",
    tone: "success",
    group: "upcoming",
  },
  completed: {
    status: "completed",
    label: "Completed",
    headline: "Completed",
    tone: "info",
    group: "completed",
  },
  declined: {
    status: "declined",
    label: "Declined",
    headline: "Declined",
    tone: "neutral",
    group: "closed",
  },
  cancelled: {
    status: "cancelled",
    label: "Cancelled",
    headline: "Cancelled",
    tone: "neutral",
    group: "closed",
  },
  disputed: {
    status: "disputed",
    label: "Disputed",
    headline: "Under dispute",
    tone: "danger",
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

/** Shared booking line item shape for client and vendor detail responses. */
export type BookingLineItem = {
  id: string;
  heading: string;
  unit_price_gbp: number | null;
  description?: string | null;
  feature_lines?: string[];
  timeline_line?: string | null;
  quantity?: number | null;
  unit_rate_gbp?: number | null;
  unit_label?: string | null;
};

/** List filter: active = pending+accepted, closed = declined+cancelled (+ completed for some APIs). */
export type ParticipantBookingsListGroup = "active" | "closed" | "completed";

export type ConfirmCompletionResponse = {
  success: boolean;
  booking_request_id: string;
  booking_status: string;
  payment_status: string;
  awaiting_other_party: boolean;
};
