/**
 * Confidence badge: the baseline's score bands and the "Confidence N%" label.
 *
 * 80 and above is green, 55–79 amber, below 55 neutral. The badge shows at
 * most the first three reasons; slicing happens in the component.
 */

export type ConfidenceBand = "high" | "medium" | "low";

/** Which colour band a 0–100 confidence score falls into. */
export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/** Tailwind classes for `confidenceBand`, matching `ConfidenceBadge` in the baseline. */
export function confidenceBadgeClass(score: number): string {
  const band = confidenceBand(score);
  if (band === "high") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (band === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-neutral-200 bg-neutral-50 text-neutral-800";
}

/** The badge's heading, e.g. "Confidence 90%". */
export function confidenceLabel(score: number): string {
  return `Confidence ${score}%`;
}
