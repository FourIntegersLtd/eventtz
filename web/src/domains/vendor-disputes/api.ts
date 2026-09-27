import { platformRequest, type components } from "@/foundation/platform-client";

/**
 * The vendor disputes domain's requests. Components never call
 * `platformRequest` directly (enforced by `eslint.config.mjs`'s
 * `no-restricted-imports`) — they call the named functions here.
 */

export type DisputePublic = components["schemas"]["DisputePublic"];

/** Every dispute on a booking the vendor is party to, most recently opened first. */
export function fetchVendorDisputes(): Promise<DisputePublic[]> {
  return platformRequest<components["schemas"]["DisputesListResponse"]>("/api/v1/vendor/disputes").then(
    (response) => response.disputes,
  );
}

/** One dispute, if the vendor is a party to its booking. */
export function fetchVendorDispute(disputeId: string): Promise<DisputePublic> {
  return platformRequest<components["schemas"]["DisputeDetailResponse"]>(
    `/api/v1/vendor/disputes/${encodeURIComponent(disputeId)}`,
  ).then((response) => response.dispute);
}
