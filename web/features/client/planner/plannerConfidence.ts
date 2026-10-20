/** Maps planner confidence score to C07 badge copy. */
export function plannerConfidenceBadge(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "High confidence", className: "ez-badge ez-badge--success" };
  if (score >= 55) return { label: "Medium confidence", className: "ez-badge ez-badge--warning" };
  return { label: "Low confidence", className: "ez-badge ez-badge--neutral" };
}
