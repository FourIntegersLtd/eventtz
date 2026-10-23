import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type AdminFinancialsDailyBucket = components["schemas"]["AdminFinancialsDailyBucket"];

export type AdminFinancialsSummary = components["schemas"]["AdminFinancialsSummary"];

export const ADMIN_FINANCIALS_DAILY_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export type AdminFinancialsDailyPage = {
  daily: AdminFinancialsDailyBucket[];
  total: number;
  offset: number;
  limit: number;
};

export async function fetchAdminFinancials(
  date_from?: string,
  date_to?: string,
): Promise<AdminFinancialsSummary> {
  const { data } = await api.get<AdminFinancialsSummary>("/api/v1/admin/financials/summary", {
    params: { date_from, date_to },
  });
  return { ...data, daily: data.daily ?? [] };
}

export async function fetchAdminFinancialsDailyPage(
  date_from?: string,
  date_to?: string,
  offset = 0,
  limit = ADMIN_FINANCIALS_DAILY_PAGE_SIZE,
): Promise<AdminFinancialsDailyPage> {
  const { data } = await api.get<components["schemas"]["AdminFinancialsDailyListResponse"]>("/api/v1/admin/financials/daily", {
    params: { date_from, date_to, offset, limit },
  });
  return {
    daily: data.daily ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function downloadAdminFinancialsCsv(date_from?: string, date_to?: string): Promise<void> {
  const { data } = await api.get<Blob>("/api/v1/admin/financials/export.csv", {
    params: { date_from, date_to },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eventtz-financials.csv";
  a.click();
  URL.revokeObjectURL(url);
}
