import type { AdminAuditLogItem } from "@/lib/adminPlatformApi";

export type AuditCategory =
  | "all"
  | "bookings"
  | "clients"
  | "vendors"
  | "disputes"
  | "reviews"
  | "chat"
  | "financials";

const ACTION_LABELS: Record<string, string> = {
  "booking.view": "Viewed booking",
  "booking.payment_fields.patch": "Updated booking payment records",
  "financials.export_csv": "Exported financials report",
  "client.suspend": "Suspended client account",
  "client.unsuspend": "Restored client account",
  "dispute.patch": "Updated dispute",
  "review.hide": "Hid review from public profile",
  "review.unhide": "Restored review to public profile",
  "chat.view": "Viewed conversation",
  "vendor.approval": "Changed vendor approval",
};

const CATEGORY_BY_ACTION: Record<string, AuditCategory> = {
  "booking.view": "bookings",
  "booking.payment_fields.patch": "bookings",
  "financials.export_csv": "financials",
  "client.suspend": "clients",
  "client.unsuspend": "clients",
  "dispute.patch": "disputes",
  "review.hide": "reviews",
  "review.unhide": "reviews",
  "chat.view": "chat",
  "vendor.approval": "vendors",
};

export const AUDIT_CATEGORIES: { id: AuditCategory; label: string }[] = [
  { id: "all", label: "All activity" },
  { id: "bookings", label: "Bookings" },
  { id: "clients", label: "Clients" },
  { id: "vendors", label: "Vendors" },
  { id: "disputes", label: "Disputes" },
  { id: "reviews", label: "Reviews" },
  { id: "chat", label: "Chat" },
  { id: "financials", label: "Financials" },
];

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function disputeStatusLabel(status: string): string {
  return capitalize(status);
}

function resolutionLabel(action: string): string {
  switch (action) {
    case "release_to_vendor":
      return "released payout to vendor";
    case "refund_client":
      return "refunded client in full";
    case "partial_refund":
      return "issued partial refund to client";
    default:
      return action.replace(/_/g, " ");
  }
}

function formatPayloadDetails(action: string, payload: Record<string, unknown> | null | undefined): string {
  if (!payload || Object.keys(payload).length === 0) {
    if (action === "booking.view" || action === "chat.view") {
      return "Support / compliance lookup — access is recorded.";
    }
    return "";
  }

  switch (action) {
    case "vendor.approval": {
      const status = String(payload.approval_status ?? "");
      if (status === "approved") return "Vendor is now approved and visible on the marketplace.";
      if (status === "banned") return "Vendor was banned and hidden from search.";
      if (status === "pending") return "Vendor was moved back to pending review.";
      return status ? `Approval set to ${status}.` : "";
    }
    case "client.suspend":
      return "The client can no longer sign in or use the platform.";
    case "client.unsuspend":
      return "The client can sign in and use the platform again.";
    case "review.hide":
      return "The review no longer appears on the vendor's public profile.";
    case "review.unhide":
      return "The review is visible on the vendor's public profile again.";
    case "financials.export_csv": {
      const from = payload.date_from ? String(payload.date_from) : null;
      const to = payload.date_to ? String(payload.date_to) : null;
      if (from && to) return `Date range: ${from} to ${to}.`;
      if (from) return `From ${from}.`;
      if (to) return `Up to ${to}.`;
      return "Full financials export.";
    }
    case "booking.payment_fields.patch": {
      const parts: string[] = [];
      if ("stripe_payment_intent_id" in payload) parts.push("payment intent ID");
      if ("stripe_charge_id" in payload) parts.push("charge ID");
      if ("payment_amount_gbp" in payload) {
        const amt = payload.payment_amount_gbp;
        parts.push(amt != null ? `amount (£${amt})` : "payment amount");
      }
      return parts.length ? `Updated ${parts.join(", ")} for reconciliation.` : "Updated Stripe payment fields.";
    }
    case "dispute.patch": {
      const parts: string[] = [];
      if (payload.status != null) {
        parts.push(`Status → ${disputeStatusLabel(String(payload.status))}`);
      }
      if (payload.resolution_action != null) {
        let line = `Money decision: ${resolutionLabel(String(payload.resolution_action))}`;
        if (payload.refund_amount_gbp != null) {
          line += ` (£${payload.refund_amount_gbp})`;
        }
        parts.push(line);
      }
      if (payload.internal_notes != null) parts.push("Internal notes updated");
      if (payload.resolution_note != null) parts.push("Resolution note updated");
      if (payload.assigned_admin_id != null) parts.push("Case assigned to an admin");
      return parts.join(" · ") || "Dispute details were updated.";
    }
    default:
      return "";
  }
}

export function formatAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? capitalize(action.replace(/\./g, " — "));
}

export function getAuditCategory(action: string): AuditCategory {
  return CATEGORY_BY_ACTION[action] ?? "all";
}

export function formatAuditWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function formatAuditEntityLabel(entityType: string): string {
  switch (entityType) {
    case "booking_request":
      return "Booking";
    case "dispute_case":
      return "Dispute";
    case "conversation":
      return "Conversation";
    case "user":
      return "Client account";
    case "vendor":
      return "Vendor";
    case "booking_review":
      return "Review";
    case "financials":
      return "Financials";
    default:
      return capitalize(entityType);
  }
}

export function auditEntityHref(entry: AdminAuditLogItem): string | null {
  if (!entry.entity_id) return null;
  switch (entry.entity_type) {
    case "booking_request":
      return `/admin/bookings/${entry.entity_id}`;
    case "dispute_case":
      return `/admin/trust?tab=disputes`;
    case "conversation":
      return `/admin/trust?tab=chat&conversation=${encodeURIComponent(entry.entity_id)}`;
    case "user":
      return `/admin/directory?tab=clients`;
    case "vendor":
      return `/admin/directory?tab=vendors`;
    case "booking_review":
      return `/admin/trust?tab=reviews`;
    default:
      return null;
  }
}

export function formatAuditSummary(entry: AdminAuditLogItem): string {
  const details = formatPayloadDetails(entry.action, entry.payload ?? undefined);
  if (details) return details;

  const entity = formatAuditEntityLabel(entry.entity_type);
  if (entry.entity_id) {
    return `Related ${entity.toLowerCase()} ${entry.entity_id.slice(0, 8)}…`;
  }
  return `Activity recorded for ${entity.toLowerCase()}.`;
}

export function hasTechnicalPayload(entry: AdminAuditLogItem): boolean {
  const p = entry.payload;
  return Boolean(p && Object.keys(p).length > 0);
}
