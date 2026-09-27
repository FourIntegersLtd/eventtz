import { humanize } from "@/capabilities/admin-shell/format";

/**
 * Turns a raw audit `action` code (`"booking.payment_fields.patch"`) into the
 * short label the list and detail screens show, matching the baseline's
 * `formatAuditActionLabel`. Falls back to a generic humanised version of the
 * code for an action this list has no bespoke copy for.
 */
const ACTION_LABELS: Record<string, string> = {
  "booking.view": "Viewed booking",
  "booking.payment_fields.patch": "Edited payment fields",
  "financials.export_csv": "Exported financials report",
  "client.suspend": "Suspended client",
  "client.unsuspend": "Reactivated client",
  "dispute.patch": "Updated dispute",
  "review.hide": "Hid review",
  "review.unhide": "Unhid review",
  "chat.view": "Viewed conversation",
  "vendor.approval": "Changed vendor approval",
  "admin.team_patch": "Updated admin team member",
};

export function formatAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action.replace(/\./g, " "));
}
