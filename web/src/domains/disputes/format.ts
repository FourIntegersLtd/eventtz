/**
 * Display-only formatters for the shared disputes domain.
 *
 * Kept separate from the bookings domains even where a label overlaps:
 * a domain may import only itself, capabilities and foundation, so disputes
 * keeps its own copy rather than reaching into client-bookings or
 * vendor-bookings.
 *
 * Labels and colours match the baseline `participantDisputeStatusLabel` /
 * `participantDisputeStatusBadgeClass`, and the list/detail "opened by"
 * wording matches `ParticipantDisputesListView` and
 * `ParticipantDisputeDetailPanel`.
 */

/** Intro above the list, from `DisputesPortalPage`. */
export const DISPUTES_LIST_INTRO = "Your disputes. Select one for details.";

/** Empty list, from the baseline empty state title. */
export const DISPUTES_EMPTY_TITLE = "No disputes yet.";

/** Shown when the list request fails and the API sent no detail. */
export const DISPUTES_LOAD_ERROR = "Could not load disputes.";

/** Shown when a dispute detail request fails and the API sent no detail. */
export const DISPUTE_DETAIL_LOAD_ERROR = "Could not load this dispute.";

/** Shown when the detail request succeeded but returned nothing. */
export const DISPUTE_NOT_FOUND = "Dispute not found.";

const DISPUTE_STATUS_LABELS: Readonly<Record<string, string>> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

const DISPUTE_STATUS_BADGE_CLASS: Readonly<Record<string, string>> = {
  open: "bg-amber-100 text-amber-900",
  under_review: "bg-sky-100 text-sky-900",
  resolved: "bg-emerald-100 text-emerald-900",
  closed: "bg-neutral-200 text-neutral-700",
};

/** A human label for a dispute's `status`; falls back to the raw code for one the frontend doesn't know yet. */
export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABELS[status] ?? status;
}

/** Tailwind classes for the status pill. Unknown statuses use the neutral fallback. */
export function disputeStatusBadgeClass(status: string): string {
  return DISPUTE_STATUS_BADGE_CLASS[status] ?? "bg-neutral-100 text-neutral-700";
}

/** Formats an ISO date (or datetime) string for a person, e.g. "12 Jun 2026". */
export function formatEventDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date to be confirmed";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

/**
 * Date and time for "opened" and "resolved", matching the baseline
 * `formatDateTime` (en-GB medium date, short time). Missing values are "-".
 */
export function formatDisputeDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "-";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

/** List-row title: event name, with the event date when the API sent one. Otherwise "Booking". */
export function disputeBookingLabel(dispute: {
  event_name?: string | null;
  event_date?: string | null;
}): string {
  if (!dispute.event_name) return "Booking";
  if (!dispute.event_date) return dispute.event_name;
  return `${dispute.event_name} · ${formatEventDate(dispute.event_date)}`;
}

/**
 * Who opened the case, as the list row says it. A vendor opener with no
 * display name falls back to the vendor's business name.
 */
export function disputeListOpenedByLabel(dispute: {
  opened_by_you: boolean;
  opened_by_display_name?: string | null;
  opened_by_role?: "client" | "vendor" | null;
  vendor_display_name?: string | null;
}): string {
  if (dispute.opened_by_you) return "You";
  if (dispute.opened_by_display_name) return dispute.opened_by_display_name;
  if (dispute.opened_by_role === "client") return "Client";
  if (dispute.opened_by_role === "vendor") return dispute.vendor_display_name ?? "Vendor";
  return "-";
}

/** Who opened the case, as the detail panel says it (a trimmed name, then a role phrase). */
export function disputeDetailOpenedByLabel(dispute: {
  opened_by_you: boolean;
  opened_by_display_name?: string | null;
  opened_by_role?: "client" | "vendor" | null;
}): string {
  if (dispute.opened_by_you) return "You";
  const displayName = dispute.opened_by_display_name?.trim();
  if (displayName) return displayName;
  if (dispute.opened_by_role === "client") return "The client";
  if (dispute.opened_by_role === "vendor") return "The vendor";
  return "Someone on this booking";
}

/** The list row's clock: last update, or when it was opened, or "-" when neither was sent. */
export function disputeUpdatedLabel(dispute: {
  updated_at?: string | null;
  created_at?: string | null;
}): string {
  return formatDisputeDateTime(dispute.updated_at || dispute.created_at);
}

/**
 * The API returns disputes most recently opened first. Sorting here keeps
 * that order even if a response arrives unsorted. A missing `created_at`
 * sorts last. Equal timestamps keep their incoming order.
 */
export function disputesMostRecentlyOpened<Dispute extends { created_at?: string | null }>(
  disputes: readonly Dispute[],
): Dispute[] {
  return disputes
    .map((dispute, index) => ({ dispute, index }))
    .sort((left, right) => {
      const byOpenedAt = (right.dispute.created_at ?? "").localeCompare(left.dispute.created_at ?? "");
      return byOpenedAt !== 0 ? byOpenedAt : left.index - right.index;
    })
    .map((entry) => entry.dispute);
}
