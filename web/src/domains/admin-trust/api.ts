import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminDisputeCase = components["schemas"]["AdminDisputeCase"];
export type AdminReviewRow = components["schemas"]["AdminReviewRow"];

/** Every dispute in a status bucket ("open" also surfaces under_review). */
export async function fetchAdminDisputes(status: string = "open"): Promise<AdminDisputeCase[]> {
  const response = await platformRequest<components["schemas"]["AdminDisputesListResponse"]>(
    "/api/v1/admin/disputes",
    { query: { status } },
  );
  return response.disputes;
}

/**
 * Triages or resolves a dispute. Only a super admin may set a financial
 * `resolution_action` (refund/payout) — the API itself enforces this and
 * returns `dispute_financial_resolution_super_admin_only` if a plain admin
 * tries, but the view hides the financial fields from plain admins too.
 */
export async function patchAdminDispute(
  disputeId: string,
  body: components["schemas"]["AdminDisputePatchBody"],
): Promise<AdminDisputeCase> {
  return platformRequest<AdminDisputeCase>(`/api/v1/admin/disputes/${encodeURIComponent(disputeId)}`, {
    method: "PATCH",
    body,
  });
}

/** Every review, hidden ones included. */
export async function fetchAdminReviews(): Promise<AdminReviewRow[]> {
  const response = await platformRequest<components["schemas"]["AdminReviewsListResponse"]>("/api/v1/admin/reviews");
  return response.reviews ?? [];
}

/** One review with its booking's event context, for the moderation screen. */
export async function fetchAdminReview(reviewId: string): Promise<AdminReviewRow> {
  const response = await platformRequest<components["schemas"]["AdminReviewDetailResponse"]>(
    `/api/v1/admin/reviews/${encodeURIComponent(reviewId)}`,
  );
  return response.review;
}

/** Hides or unhides a review. Any admin may moderate reviews (not super-admin-only). */
export async function setAdminReviewVisibility(reviewId: string, hidden: boolean): Promise<void> {
  await platformRequest<components["schemas"]["ReviewVisibilityResponse"]>(
    `/api/v1/admin/reviews/${encodeURIComponent(reviewId)}/visibility`,
    { method: "PATCH", body: { hidden } },
  );
}
