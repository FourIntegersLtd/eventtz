/**
 * Maps a Growth Score lever's 0-100 status to display copy.
 *
 * The API already classifies each lever as "good" | "ok" | "needs_work"
 * (`GrowthScoreLever.status`), so this only turns that enum into the label
 * and tone the panel renders — no re-deriving the threshold client-side.
 */

export type GrowthScoreLeverStatus = "good" | "ok" | "needs_work";

export interface GrowthScoreStatusPresentation {
  label: string;
  /** Tailwind text/background token suffix, matching the shared status palette. */
  tone: "success" | "warning" | "critical";
}

const STATUS_PRESENTATION: Record<GrowthScoreLeverStatus, GrowthScoreStatusPresentation> = {
  good: { label: "Good", tone: "success" },
  ok: { label: "Could improve", tone: "warning" },
  needs_work: { label: "Needs work", tone: "critical" },
};

/** Display label and tone for one Growth Score lever's status. */
export function growthScoreStatusPresentation(status: GrowthScoreLeverStatus): GrowthScoreStatusPresentation {
  return STATUS_PRESENTATION[status];
}

/** Whole-score band used for the headline number's colour (0-100 scale). */
export function growthScoreBand(score: number): "success" | "warning" | "critical" {
  if (score >= 75) return "success";
  if (score >= 40) return "warning";
  return "critical";
}
