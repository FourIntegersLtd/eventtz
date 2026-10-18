import { TONE } from "@/components/ui/tokens";
import type { Tone } from "@/lib/tone";

export type StatTileProps = {
  label: string;
  value: string;
  /** Optional change text, e.g. "+12% this month". */
  delta?: string;
  deltaTone?: Tone;
  className?: string;
};

/** KPI tile: small label, large value and an optional toned delta. */
export function StatTile({ label, value, delta, deltaTone = "neutral", className = "" }: StatTileProps) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-5 shadow-xs ${className}`.trim()}>
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-1.5 font-heading text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {delta ? (
        <p className={`mt-1 text-xs font-medium ${TONE[deltaTone].text}`}>{delta}</p>
      ) : null}
    </div>
  );
}
