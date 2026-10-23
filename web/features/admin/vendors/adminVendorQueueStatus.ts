import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { payloadStr } from "./vendorFormatters";
import { formatDate } from "@/lib/dateFormat";

const VENDOR_QUEUE_TABS = ["all", "pending", "returned", "draft", "approved", "suspended"] as const;

export type VendorQueueTab = (typeof VENDOR_QUEUE_TABS)[number];

/** The list opens on every vendor; staff narrow it with the filter. */
export const DEFAULT_VENDOR_QUEUE_TAB: VendorQueueTab = "all";

/** The tab named by the `queue` url parameter, or the default when it is missing or unknown. */
export function parseVendorQueueTab(raw: string | null): VendorQueueTab {
  return VENDOR_QUEUE_TABS.find((tab) => tab === raw) ?? DEFAULT_VENDOR_QUEUE_TAB;
}

/**
 * The empty-list copy, naming what narrows the list so an empty result never looks like an
 * empty platform.
 */
export function vendorListEmptyCopy(
  tab: VendorQueueTab,
  tabLabel: string,
  search: string,
): { title: string; description?: string } {
  const searchText = search.trim();
  const filtered = tab !== DEFAULT_VENDOR_QUEUE_TAB;
  if (searchText) {
    return {
      title: "No vendors match your filters",
      description: `Showing: ${tabLabel}, search "${searchText}".`,
    };
  }
  if (filtered) {
    return {
      title: "No vendors match your filters",
      description: `Showing: ${tabLabel}. Clear the filter to see every vendor.`,
    };
  }
  return { title: "No vendors yet" };
}

export function vendorWasReturnedForEdits(row: AdminVendorRow): boolean {
  const payload = row.profile_form_data ?? {};
  const raw = payload.returnedForEditsAt;
  return raw != null && String(raw).trim() !== "";
}

export function vendorCategoryLabel(row: AdminVendorRow): string {
  const payload = row.profile_form_data ?? {};
  const services = payload.servicesOffered;
  if (Array.isArray(services) && services.length > 0) {
    const first = String(services[0] ?? "").trim();
    if (first) return first.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const category = payloadStr(payload, "category") || payloadStr(payload, "businessType");
  return category || "-";
}

export function vendorAreaLabel(row: AdminVendorRow): string {
  const payload = row.profile_form_data ?? {};
  return payloadStr(payload, "baseCity") || payloadStr(payload, "city") || "-";
}

export function vendorSubmittedLabel(row: AdminVendorRow): string {
  const raw = row.updated_at ?? row.created_at;
  if (!raw) return "-";
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 10);
  return formatDate(date, "dayMonthYear");
}

export function vendorQueueStatusBadge(row: AdminVendorRow): {
  label: string;
  tone: "warning" | "info" | "success" | "neutral" | "danger";
} {
  if (row.approval_status === "banned") {
    return { label: "Suspended", tone: "neutral" };
  }
  if (row.approval_status === "approved") {
    if (!row.payouts_verified) {
      return { label: "Approved · payouts pending", tone: "warning" };
    }
    return { label: "Approved", tone: "success" };
  }
  if (row.approval_status === "pending") {
    if (row.onboarding_status === "submitted") {
      const created = row.created_at ? new Date(String(row.created_at)).getTime() : 0;
      const updated = row.updated_at ? new Date(String(row.updated_at)).getTime() : created;
      if (updated - created > 86_400_000) {
        return { label: "Resubmitted", tone: "info" };
      }
      return { label: "Pending review", tone: "warning" };
    }
    if (vendorWasReturnedForEdits(row)) {
      return { label: "Returned", tone: "info" };
    }
    return { label: "Draft", tone: "neutral" };
  }
  return { label: String(row.approval_status ?? "Unknown"), tone: "neutral" };
}

export function vendorQueueFilters(tab: VendorQueueTab): {
  approvalStatus: string;
  profileStatus: string;
  returnedForEdits?: boolean;
} {
  switch (tab) {
    case "all":
      return { approvalStatus: "", profileStatus: "" };
    case "pending":
      return { approvalStatus: "pending", profileStatus: "submitted" };
    case "returned":
      return {
        approvalStatus: "pending",
        profileStatus: "draft",
        returnedForEdits: true,
      };
    case "draft":
      return {
        approvalStatus: "pending",
        profileStatus: "draft",
        returnedForEdits: false,
      };
    case "approved":
      return { approvalStatus: "approved", profileStatus: "" };
    case "suspended":
      return { approvalStatus: "banned", profileStatus: "" };
  }
}
