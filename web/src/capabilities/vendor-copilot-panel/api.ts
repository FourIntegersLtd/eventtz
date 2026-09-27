import { platformRequest, type components } from "@/foundation/platform-client";

/**
 * The vendor co-pilot's requests.
 *
 * This is a `capability`, not a `domain`, because both the dashboard and
 * analytics pages show the same growth-score/brief/ask panel, and the eslint
 * boundaries only let a domain import itself — a capability is the one tier
 * two unrelated domains may both reach for (see `web/eslint.config.mjs`).
 */

export type GrowthScoreResponse = components["schemas"]["GrowthScoreResponse"];
export type VendorCopilotBriefResponse = components["schemas"]["VendorCopilotBriefResponse"];
export type CopilotAskRequest = components["schemas"]["CopilotAskRequest"];
export type CopilotAskResponse = components["schemas"]["CopilotAskResponse"];
export type CopilotAskMessage = components["schemas"]["CopilotAskMessage"];
export type CopilotAction = components["schemas"]["CopilotAction"];

/** The vendor's deterministic Growth Score, broken down by lever. */
export function fetchGrowthScore(): Promise<GrowthScoreResponse> {
  return platformRequest<GrowthScoreResponse>("/api/v1/vendor/copilot/score");
}

/** The AI-written daily brief: a greeting, a summary, and suggested actions. */
export function fetchCopilotBrief(): Promise<VendorCopilotBriefResponse> {
  return platformRequest<VendorCopilotBriefResponse>("/api/v1/vendor/copilot/brief");
}

/** Ask the co-pilot a free-text question, optionally with chat history. */
export function askCopilot(body: CopilotAskRequest): Promise<CopilotAskResponse> {
  return platformRequest<CopilotAskResponse>("/api/v1/vendor/copilot/ask", {
    method: "POST",
    body,
  });
}
