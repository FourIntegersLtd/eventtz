/**
 * Confidence score, colour, and up to three reasons. The colour comes from
 * `confidenceBand` (green from 80, amber from 55).
 */
import { confidenceBadgeClass, confidenceLabel } from "@/domains/client-planner/confidence";

export interface ConfidenceBadgeProps {
  score: number;
  reasons: readonly string[];
}

/** The confidence card beside the celebration summary. */
export function ConfidenceBadge({ score, reasons }: ConfidenceBadgeProps) {
  const visibleReasons = reasons.slice(0, 3);
  return (
    <div className={`rounded-xl border px-4 py-3 ${confidenceBadgeClass(score)}`}>
      <p className="text-sm font-semibold">{confidenceLabel(score)}</p>
      {visibleReasons.length ? (
        <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed opacity-90">
          {visibleReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
