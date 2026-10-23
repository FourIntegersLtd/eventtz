import type { AdminDisputeCase } from "@/lib/adminPlatformApi";
import { participantDisputeBookingLabel } from "@/lib/bookingDisputeHelpers";
import { formatDate } from "@/lib/dateFormat";

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return formatDate(d, "dateTimeMedium");
}

export function statusLabel(s: AdminDisputeCase["status"]): string {
  return s.replace(/_/g, " ");
}

export function resolutionActionLabel(a: AdminDisputeCase["resolution_action"]): string {
  switch (a) {
    case "release_to_vendor":
      return "Release payout to vendor";
    case "refund_client":
      return "Refund client in full";
    case "partial_refund":
      return "Partial refund to client";
    case "vendor_no_show":
      return "Vendor didn't turn up (full refund, counts against the vendor)";
    default:
      return "-";
  }
}

export const DISPUTE_STATUSES: AdminDisputeCase["status"][] = [
  "open",
  "under_review",
  "resolved",
  "closed",
];

export const RESOLUTION_ACTIONS: NonNullable<AdminDisputeCase["resolution_action"]>[] = [
  "release_to_vendor",
  "refund_client",
  "partial_refund",
  "vendor_no_show",
];

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return formatDate(d, "dateMedium");
}

export function openedByLabel(
  role: AdminDisputeCase["opened_by_role"],
  email: string | null | undefined,
): string {
  const who = role === "client" ? "Client" : role === "vendor" ? "Vendor" : "Party";
  if (email) return `${who} (${email})`;
  return who;
}

export function bookingStatusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return status.replace(/_/g, " ");
}

export function disputeBookingLabel(dispute: AdminDisputeCase): string {
  return participantDisputeBookingLabel(dispute);
}

export function assignmentLabel(
  assignedAdminId: string | null | undefined,
  currentUserId: string | null | undefined,
  assignedAdminEmail?: string | null,
): string {
  if (!assignedAdminId) return "Unassigned";
  if (currentUserId && assignedAdminId === currentUserId) return "Assigned to you";
  if (assignedAdminEmail) return assignedAdminEmail;
  return "Assigned to colleague";
}
