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

/** KPI tile (`ez-kpi`): small label, large serif value and an optional toned delta. */
export function StatTile({ label, value, delta, deltaTone = "neutral", className = "" }: StatTileProps) {
  return (
    <div className={`ez-kpi ${className}`.trim()}>
      <span className="ez-kpi__label">{label}</span>
      <span className="ez-kpi__value">{value}</span>
      {delta ? <span className={`ez-kpi__delta ${TONE[deltaTone].text}`}>{delta}</span> : null}
    </div>
  );
}
