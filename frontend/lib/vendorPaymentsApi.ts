import api from "@/lib/axios";
export { getApiErrorDetail } from "@/lib/api-errors";

export type VendorPaymentsStatus = {
  success: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

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

export async function fetchStripePaymentsStatus(): Promise<VendorPaymentsStatus> {
  const { data } = await api.get<VendorPaymentsStatus>("/api/v1/vendor/payments/status");
  return data;
}
