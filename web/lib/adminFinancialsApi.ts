import api from "@/lib/axios";

export type AdminFinancialsDailyBucket = {
  date: string;
  count: number;
  gmv_gbp: number;
  platform_fee_gbp: number;
  vendor_portion_gbp: number;
};

export type AdminFinancialsSummary = {
  success: boolean;
  period_from: string | null;
  period_to: string | null;
  paid_booking_count: number;
  gmv_gbp: number;
  platform_fee_gbp: number;
  vendor_portion_gbp: number;
  service_fee_percent: number;
  /** Vendor portion already sent out via Stripe Transfer. */
  payout_released_gbp: number;
  /** Vendor portion collected but still sitting in Eventtz's Stripe balance. */
  held_in_platform_balance_gbp: number;
  /** Present once backend exposes time-series buckets; empty when unavailable. */
  daily?: AdminFinancialsDailyBucket[];
  disclaimer: string;
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
