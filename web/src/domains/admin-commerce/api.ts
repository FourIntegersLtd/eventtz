import { platformAccessToken, platformApiUrl, platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminBookingListItem = components["schemas"]["AdminBookingListItem"];
export type AdminFinancialsSummary = components["schemas"]["AdminFinancialsSummary"];
export type AdminMarketplaceAnalytics = components["schemas"]["AdminMarketplaceAnalyticsResponse"];

/**
 * One page of the admin bookings list, for Commerce's Bookings tab.
 *
 * Duplicated from `domains/admin-bookings/api.ts` rather than imported: the
 * eslint boundaries rule (`web/eslint.config.mjs`) forbids one domain
 * importing another, and this request is small enough that a shared
 * `capabilities/` module would be more ceremony than the duplication it saves.
 */
export interface AdminBookingsQuery {
  offset?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  needs_attention?: boolean;
}

export async function fetchAdminBookings(
  query: AdminBookingsQuery = {},
): Promise<{ bookings: AdminBookingListItem[]; total: number; offset: number; limit: number }> {
  return platformRequest<components["schemas"]["AdminBookingsListResponse"]>("/api/v1/admin/bookings", {
    query: { ...query },
  });
}

/** Totals for the financials screen, over an optional date range. */
export async function fetchAdminFinancials(dateFrom?: string, dateTo?: string): Promise<AdminFinancialsSummary> {
  return platformRequest<AdminFinancialsSummary>("/api/v1/admin/financials/summary", {
    query: { date_from: dateFrom, date_to: dateTo },
  });
}

/**
 * Downloads the financials CSV and saves it, matching the baseline's
 * `downloadAdminFinancialsCsv`. The export route needs an `Authorization`
 * header, which a plain `<a href>` cannot send, so this fetches the file as
 * a blob and clicks a throwaway link — `platformRequest` always decodes
 * JSON, so this calls `fetch` directly with the same bearer token instead.
 */
export async function downloadAdminFinancialsCsv(dateFrom?: string, dateTo?: string): Promise<void> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.toString();
  const token = await platformAccessToken();
  const response = await fetch(`${platformApiUrl()}/api/v1/admin/financials/export.csv${query ? `?${query}` : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "eventtz-financials.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The marketplace funnel: enquiries through acceptance, payment and completion. */
export async function fetchAdminMarketplaceAnalytics(params?: {
  from_date?: string;
  to_date?: string;
}): Promise<AdminMarketplaceAnalytics> {
  return platformRequest<AdminMarketplaceAnalytics>("/api/v1/admin/marketplace-analytics", { query: params });
}
