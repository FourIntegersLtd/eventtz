import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export { getApiErrorDetail } from "@/lib/api-errors";

export type VendorPaymentsStatus = components["schemas"]["VendorPaymentsStatusResponse"];

export type VendorPayoutStatus = "paid_out" | "awaiting_payout";

export type VendorPayoutRow = components["schemas"]["VendorPayoutRow"];

export type VendorPayoutHistory = components["schemas"]["VendorPayoutHistoryResponse"];

export const VENDOR_PAYOUTS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function postConnectStripeAccount(
  returnPath?: string,
): Promise<{ onboarding_url: string }> {
  const { data } = await api.post<{ success: boolean; onboarding_url: string }>(
    "/api/v1/vendor/payments/connect-account",
    null,
    returnPath ? { params: { return_path: returnPath } } : undefined,
  );
  return data;
}

export async function fetchVendorStripeConnectStatus(): Promise<VendorPaymentsStatus> {
  const { data } = await api.get<VendorPaymentsStatus>("/api/v1/vendor/payments/status");
  return data;
}

/** Vendor earnings ledger - their share only, not the client total Eventtz charged. */
export async function fetchVendorPayoutHistoryPage(
  offset = 0,
  limit = VENDOR_PAYOUTS_PAGE_SIZE,
): Promise<VendorPayoutHistory> {
  const { data } = await api.get<VendorPayoutHistory>("/api/v1/vendor/payments/history", {
    params: { offset, limit },
  });
  return data;
}
