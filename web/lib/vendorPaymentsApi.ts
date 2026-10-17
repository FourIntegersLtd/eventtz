import api from "@/lib/axios";
export { getApiErrorDetail } from "@/lib/api-errors";

export type VendorPaymentsStatus = {
  success: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  /** Mirrors backend accept gate (Stripe ready or admin listing waiver). */
  can_accept_bookings?: boolean;
  payout_gate_waived?: boolean;
};

export type VendorPayoutStatus = "paid_out" | "awaiting_payout";

export type VendorPayoutRow = {
  booking_id: string;
  event_name: string;
  event_date: string | null;
  client_display_name: string | null;
  amount_gbp: number;
  amount_label: string;
  status: VendorPayoutStatus | string;
  /** `cancellation_share` rows are the vendor's cut of a cancelled paid booking. */
  kind?: "event_payout" | "cancellation_share";
  paid_out_at: string | null;
};

export type VendorPayoutHistory = {
  success: boolean;
  payouts: VendorPayoutRow[];
  total_paid_out_gbp: number;
  total_paid_out_label: string;
  total_awaiting_gbp: number;
  total_awaiting_label: string;
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

export async function fetchVendorStripeConnectStatus(): Promise<VendorPaymentsStatus> {
  const { data } = await api.get<VendorPaymentsStatus>("/api/v1/vendor/payments/status");
  return data;
}

/** Vendor earnings ledger - their share only, not the client total Eventtz charged. */
export async function fetchVendorPayoutHistory(): Promise<VendorPayoutHistory> {
  const { data } = await api.get<VendorPayoutHistory>("/api/v1/vendor/payments/history");
  return data;
}
