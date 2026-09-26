import { platformRequest, type components } from "@/foundation/platform-client";

/** The vendor's Stripe Connect payout status, as `GET /vendor/payments/status` returns it. */
export type VendorPaymentsStatus = components["schemas"]["VendorPaymentsStatusResponse"];

/** One row of the vendor's payout ledger. */
export type VendorPayoutRow = components["schemas"]["VendorPayoutRow"];

/** The vendor's payout ledger, as `GET /vendor/payments/history` returns it. */
export type VendorPayoutHistory = components["schemas"]["VendorPayoutHistoryResponse"];

/** Where to send the vendor to set up (or resume) Stripe Connect. */
export type VendorPaymentsConnect = components["schemas"]["VendorPaymentsConnectResponse"];

/** Fetch whether the vendor's payout account can take charges and pay out. */
export function fetchVendorPaymentsStatus(): Promise<VendorPaymentsStatus> {
  return platformRequest<VendorPaymentsStatus>("/api/v1/vendor/payments/status");
}

/** Fetch the vendor's payout ledger (paid and awaiting amounts, plus each booking's row). */
export function fetchVendorPayoutHistory(): Promise<VendorPayoutHistory> {
  return platformRequest<VendorPayoutHistory>("/api/v1/vendor/payments/history");
}

/**
 * Start (or resume) Stripe Connect onboarding. The API decides the Stripe
 * return URL; the route has no request body (see `openapi.json`).
 */
export function startVendorPayoutsConnect(): Promise<VendorPaymentsConnect> {
  return platformRequest<VendorPaymentsConnect>("/api/v1/vendor/payments/connect-account", {
    method: "POST",
  });
}
