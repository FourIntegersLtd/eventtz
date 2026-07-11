import type { AdminDisputeCase } from "@/lib/adminPlatformApi";
import { participantDisputeBookingLabel, participantDisputeStatusBadgeClass } from "@/lib/bookingDisputeHelpers";

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function statusLabel(s: AdminDisputeCase["status"]): string {
  return s.replace(/_/g, " ");
}

export function disputeStatusBadgeClass(status: AdminDisputeCase["status"]): string {
  return participantDisputeStatusBadgeClass(status);
}

export function resolutionActionLabel(a: AdminDisputeCase["resolution_action"]): string {
  switch (a) {
    case "release_to_vendor":
      return "Release payout to vendor";
    case "refund_client":
      return "Refund client in full";
    case "partial_refund":
      return "Partial refund to client";
    default:
      return "—";
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
];

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { dateStyle: "medium" });
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
  if (!status) return "—";
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
