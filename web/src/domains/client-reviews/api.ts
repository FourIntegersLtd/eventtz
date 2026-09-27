/** The client-reviews domain's requests against `/api/v1/client/reviews`. */
import { platformRequest, type components } from "@/foundation/platform-client";

export type ClientOwnerReviewItem = components["schemas"]["ClientOwnerReviewItem"];
export type ClientOwnerReviewsResponse = components["schemas"]["ClientOwnerReviewsResponse"];

/** Every review the signed-in client has written, newest first (empty when none). */
export function fetchClientOwnReviews(): Promise<ClientOwnerReviewItem[]> {
  return platformRequest<ClientOwnerReviewsResponse>("/api/v1/client/reviews").then(
    (response) => response.reviews ?? [],
  );
}
