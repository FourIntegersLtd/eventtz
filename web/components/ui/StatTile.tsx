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
  /** Quieter supporting line (`ez-caption`), for tiles whose canvas draws a caption rather than a hint. */
  caption?: string;
  /** Makes the whole tile a link (`ez-kpi--link`). */
  href?: string;
  className?: string;
  /** Small bordered card for dense public profiles (label above a modest value) instead of the large `ez-kpi` tile. */
  compact?: boolean;
};

/** KPI tile (`ez-kpi`, or a small card with `compact`): small label, large serif value, an optional toned delta or hint, and an optional link. */
export function StatTile({
  label,
  value,
  icon: Icon,
  delta,
  deltaTone = "neutral",
  hint,
  caption,
  href,
  className = "",
  compact = false,
}: StatTileProps) {
  if (compact) {
    return (
      <div
        className={`h-full rounded-xl border border-neutral-100 bg-white px-3.5 py-3 ${className}`.trim()}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {label}
        </div>
        <p className="mt-1.5 text-base font-semibold tabular-nums tracking-tight text-neutral-900">
          {value}
        </p>
      </div>
    );
  }

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
      {caption ? <span className="ez-caption">{caption}</span> : null}
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
