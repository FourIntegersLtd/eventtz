import type { ReactNode } from "react";
import type { BookingLineItemRow, BookingPricing } from "@/features/bookings/BookingPricingBreakdown";

/**
 * Role-agnostic row shape for `BookingListPanel`. Client and vendor feature
 * folders map their own API response types down to this before rendering —
 * the panel itself never imports `clientBookingsApi`/`vendorBookingsApi`.
 */
export type BookingListRowViewModel = {
  id: string;
  eventName: string;
  status: string;
  dateLabel: string;
  totalLabel: string;
  /** Vendor display name (client view) or client email (vendor view). */
  counterpartyLine: string;
  /** e.g. "Vendor quote" / "Your quote" badge when the vendor initiated the request. */
  initiatorBadgeLabel?: string | null;
  /** Vendor view only: the review left once a booking completes. */
  reviewLine?: string | null;
};

export type BookingDetailAction = {
  key: string;
  label: string;
  loadingLabel?: string;
  variant: "primary" | "secondary" | "ghost" | "destructive";
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Role-agnostic shape for `BookingDetailPanel`. Everything the panel itself
 * renders (header, event & contact grid, pricing, notes) reads only from
 * this — role-specific bits (vendor quote adjustments, client review form,
 * accept/decline actions) are passed in as actions/slots by the caller.
 */
export type BookingDetailViewModel = {
  id: string;
  eventName: string;
  status: string;
  /** "Requested 12 Jul 2026, 14:03" / "Sent 12 Jul 2026, 14:03". */
  timelineLabel: string;
  isVendorInitiated: boolean;
  eventDateLabel: string;
  eventEndDateLabel: string | null;
  venuePostcode: string | null;
  venueAddress: string | null;
  /** "Vendor" (client view) or "Client" (vendor view). */
  counterpartyRoleLabel: string;
  counterpartyName: string;
  counterpartyPhone?: string | null;
  counterpartyHref?: string;
  conversationId: string | null;
  /** Opens the chat Drawer with this counterparty — always available from booking detail. */
  onOpenChat: () => void;
  notesLabel: string;
  notes: string | null;
  totalLabel: string;
  pricing: BookingPricing | null;
  lineItems: BookingLineItemRow[];
  pricingVariant: "client" | "vendor";
  /** Which portal is viewing this booking — used to build the "open conversation" link. */
  portal: "client" | "vendor";
  paidAtLabel: string | null;
  /** Money lifecycle badge, independent of `status` — e.g. "Paid", "Paid out", "Refunded". */
  paymentStatus: string | null;
};

export type BookingDetailSlots = {
  /** Rendered right under the header (e.g. quote accept/decline venue picker, vendor adjustments editor). */
  beforeSections?: ReactNode;
  /** Rendered after the standard sections, before the dispute section (e.g. review form/summary). */
  afterSections?: ReactNode;
  /** Always rendered last. */
  disputeSection: ReactNode;
};
