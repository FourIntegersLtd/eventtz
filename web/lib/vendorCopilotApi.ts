import type { components } from "@/lib/api-schema";
import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "./axios";
import { getApiErrorDetail } from "./api-errors";

export type CopilotActionKind =
  | "edit_profile"
  | "open_booking"
  | "open_payments"
  | "open_analytics"
  | "open_messages"
  | "apply_package_patch";

export type CopilotAction = components["schemas"]["CopilotAction"];

export type GrowthScoreLever = components["schemas"]["GrowthScoreLever"];

export type GrowthScoreResult = components["schemas"]["GrowthScoreResponse"];

export type MarketDemandInsight = components["schemas"]["MarketDemandInsight"];

export type VendorCopilotBrief = components["schemas"]["VendorCopilotBriefResponse"];

/**
 * Request bodies stay hand-written: the API accepts these under validation aliases
 * (`message_role`, `booking_request_id`) that the generated request schema does not show.
 */
export type CopilotAskMessage = {
  message_role: "user" | "assistant" | string;
  content: string;
};

export type CopilotAskResult = components["schemas"]["CopilotAskResponse"];

/** `package_feedback` rows are free-form dicts in the API schema; narrowed by hand. */
export type CopilotPackageFeedback = {
  package_id?: string | null;
  package_title: string;
  items: string[];
  suggested_title?: string | null;
  suggested_details?: string | null;
  suggested_duration?: string | null;
};

export type CopilotReviewPackagesResult = WithFields<
  components["schemas"]["CopilotReviewPackagesResponse"],
  { package_feedback: CopilotPackageFeedback[] }
>;

export type CopilotDraftReplyResult = components["schemas"]["CopilotDraftReplyResponse"];

type BriefUiCacheEntry = {
  userId: string;
  fingerprint: string;
  data: VendorCopilotBrief;
};

let briefUiCache: BriefUiCacheEntry | null = null;
let briefInflight: Promise<VendorCopilotBrief> | null = null;
let briefInflightUserId: string | null = null;

/** Clear UI cache and in-flight dedupe (e.g. on sign-out). */
export function clearVendorCopilotBriefCache(): void {
  briefUiCache = null;
  briefInflight = null;
  briefInflightUserId = null;
}

export function getCachedVendorCopilotBrief(userId: string): VendorCopilotBrief | null {
  if (!briefUiCache || briefUiCache.userId !== userId) return null;
  return briefUiCache.data;
}

export async function fetchVendorGrowthScore(): Promise<GrowthScoreResult> {
  const res = await api.get<GrowthScoreResult>("/api/v1/vendor/copilot/score");
  return res.data;
}

export async function fetchVendorCopilotBrief(options: {
  userId: string;
}): Promise<VendorCopilotBrief> {
  const { userId } = options;
  if (!userId) {
    throw new Error("userId is required to fetch the growth brief.");
  }

  if (briefInflight && briefInflightUserId === userId) return briefInflight;

  briefInflightUserId = userId;
  briefInflight = api
    .get<VendorCopilotBrief>("/api/v1/vendor/copilot/brief")
    .then((res) => {
      briefUiCache = {
        userId,
        fingerprint: res.data.context_fingerprint,
        data: res.data,
      };
      briefInflight = null;
      briefInflightUserId = null;
      return res.data;
    })
    .catch((err) => {
      briefInflight = null;
      briefInflightUserId = null;
      throw err;
    });

  return briefInflight;
}

export async function askVendorCopilot(body: {
  question: string;
  history?: CopilotAskMessage[];
  booking_request_id?: string | null;
}): Promise<CopilotAskResult> {
  const res = await api.post<CopilotAskResult>("/api/v1/vendor/copilot/ask", body);
  return res.data;
}

export async function postCopilotReviewPackages(
  profileFormData: Record<string, unknown>,
): Promise<CopilotReviewPackagesResult> {
  const res = await api.post<CopilotReviewPackagesResult>(
    "/api/v1/vendor/copilot/review-packages",
    { profile_form_data: profileFormData },
  );
  return res.data;
}

export async function postCopilotDraftReply(body: {
  booking_request_id: string;
  intent: "accept" | "decline" | "clarify";
}): Promise<CopilotDraftReplyResult> {
  const res = await api.post<CopilotDraftReplyResult>(
    "/api/v1/vendor/copilot/draft-reply",
    body,
  );
  return res.data;
}

export function vendorCopilotErrorMessage(err: unknown): string {
  return getApiErrorDetail(err) ?? "Something went wrong. Try again.";
}
