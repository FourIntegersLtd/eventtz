import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { TONE } from "@/components/ui/tokens";
import type { Tone } from "@/lib/tone";

export type StatTileProps = {
  label: string;
  value: string | number;
  /** Small icon before the label (the canvas sizes it to 16px). */
  icon?: LucideIcon;
  /** Optional change text, e.g. "+12% this month". */
  delta?: string;
  deltaTone?: Tone;
  /** Quiet supporting line under the value (`ez-small`), for context rather than change. */
  hint?: string;
  /** Makes the whole tile a link (`ez-kpi--link`). */
  href?: string;
  className?: string;
};

/** KPI tile (`ez-kpi`): small label, large serif value, an optional toned delta or hint, and an optional link. */
export function StatTile({
  label,
  value,
  icon: Icon,
  delta,
  deltaTone = "neutral",
  hint,
  href,
  className = "",
}: StatTileProps) {
  const body = (
    <>
      <span className="ez-kpi__label">
        {Icon ? <Icon aria-hidden /> : null}
        {label}
      </span>
      <span className="ez-kpi__value">{value}</span>
      {delta ? (
        <span className={`ez-kpi__delta ${deltaTone === "danger" ? "ez-kpi__delta--down" : TONE[deltaTone].text}`}>
          {delta}
        </span>
      ) : null}
      {hint ? <span className="ez-small">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`ez-kpi ez-kpi--link ${className}`.trim()}>
        {body}
      </Link>
    );
  }
  return <div className={`ez-kpi ${className}`.trim()}>{body}</div>;
}
