import type { Tone } from "@/lib/tone";

/** Maps planner confidence score to C07 badge copy and the `Badge` tone. */
export function plannerConfidenceBadge(score: number): { label: string; tone: Tone } {
  if (score >= 80) return { label: "High confidence", tone: "success" };
  if (score >= 55) return { label: "Medium confidence", tone: "warning" };
  return { label: "Low confidence", tone: "neutral" };
}
