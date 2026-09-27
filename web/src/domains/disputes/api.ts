import { platformRequest, type components } from "@/foundation/platform-client";
import { disputeResourcePath, disputesCollectionPath, type DisputePortalRole } from "@/domains/disputes/role";

/**
 * The shared disputes domain's requests. Components never call
 * `platformRequest` directly (enforced by `eslint.config.mjs`'s
 * `no-restricted-imports`) — they call the named functions here.
 * `role` selects the client or vendor URL; the response shape is the same.
 */

export type DisputePublic = components["schemas"]["DisputePublic"];

/** Every dispute on a booking the caller is party to, most recently opened first. */
export function fetchDisputes(role: DisputePortalRole): Promise<DisputePublic[]> {
  return platformRequest<components["schemas"]["DisputesListResponse"]>(disputesCollectionPath(role)).then(
    (response) => response.disputes,
  );
}

/** One dispute, if the caller is a party to its booking. */
export function fetchDispute(role: DisputePortalRole, disputeId: string): Promise<DisputePublic> {
  return platformRequest<components["schemas"]["DisputeDetailResponse"]>(disputeResourcePath(role, disputeId)).then(
    (response) => response.dispute,
  );
}
