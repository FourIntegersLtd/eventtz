import { Fragment, type ReactNode } from "react";
import { TONE } from "@/components/ui/tokens";

/**
 * How a label/value pair is laid out:
 * - `split`: label left, value right, long values wrap (admin submission review lists)
 * - `review`: like `split` with padded rows for the vendor profile review card
 * - `stacked`: label above value, for a two-column grid of short facts
 * - `block`: label above a full-width, line-preserving value (long text such as a bio)
 * - `fact`: label column beside value for the browse profile card; `tone` highlights must-read facts
 */
export type DescriptionRowLayout = "split" | "review" | "stacked" | "block" | "fact";

export type DescriptionRowTone = "default" | "notice" | "positive";

export type DescriptionItem = {
  label: string;
  value: ReactNode;
  /** Shows the value in the amber "missing" style (`split`, `stacked`, `block`). */
  missing?: boolean;
  /** Highlights a `fact` row. */
  tone?: DescriptionRowTone;
};

export type DescriptionListProps = {
  items: readonly DescriptionItem[];
  className?: string;
  /** Omit for the canvas `ez-dl` grid; set to render rows in one of the layouts above. */
  rowLayout?: DescriptionRowLayout;
};

const MISSING_VALUE = "font-medium text-amber-800";

/** Notice maps to the warning tone, positive to success, so colours come from the shared tokens. */
const FACT_TONE_ROW = {
  notice: `rounded-control border px-4 py-3.5 ${TONE.warning.background} ${TONE.warning.line}`,
  positive: `rounded-control border px-4 py-3.5 ${TONE.success.background} ${TONE.success.line}`,
} as const;

const FACT_TONE_LABEL = {
  notice: `text-sm font-medium sm:w-36 ${TONE.warning.text}`,
  positive: `text-sm font-medium sm:w-36 ${TONE.success.text}`,
} as const;

/** One label and value pair as a `div` holding a `dt` and `dd`, for use inside any `dl`. */
export function DescriptionRow({
  label,
  value,
  missing,
  tone = "default",
  layout,
}: DescriptionItem & { layout: DescriptionRowLayout }) {
  const valueTone = missing ? MISSING_VALUE : "text-ink";
  switch (layout) {
    case "split":
      return (
        <div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <dt className="shrink-0 text-[13px] text-ink-3 sm:max-w-[40%]">{label}</dt>
          <dd className={`min-w-0 text-sm leading-snug sm:text-right ${valueTone}`}>{value}</dd>
        </div>
      );
    case "review":
      return (
        <div
          data-review-field
          className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-6"
        >
          <dt className="shrink-0 text-[13px] text-ink-3">{label}</dt>
          <dd className="min-w-0 text-sm font-medium text-ink sm:text-right">{value}</dd>
        </div>
      );
    case "stacked":
      return (
        <div className="py-1">
          <dt className="text-[13px] text-ink-3">{label}</dt>
          <dd className={`mt-1.5 text-sm leading-relaxed ${valueTone}`}>{value}</dd>
        </div>
      );
    case "block":
      return (
        <div className="py-4 first:pt-0 last:pb-0">
          <dt className="text-[13px] text-ink-3">{label}</dt>
          <dd className={`mt-2 w-full whitespace-pre-wrap text-sm leading-relaxed ${valueTone}`}>
            {value}
          </dd>
        </div>
      );
    case "fact":
      if (tone === "default") {
        return (
          <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:gap-6">
            <dt className="shrink-0 text-sm text-ink-3 sm:w-36">{label}</dt>
            <dd className="text-sm leading-relaxed text-ink">{value}</dd>
          </div>
        );
      }
      return (
        <div className={`flex flex-col gap-1.5 sm:flex-row sm:gap-6 ${FACT_TONE_ROW[tone]}`}>
          <dt className={`shrink-0 ${FACT_TONE_LABEL[tone]}`}>{label}</dt>
          <dd className="text-sm leading-relaxed text-ink">{value}</dd>
        </div>
      );
  }
}

/** Dividers between rows for the layouts that stack full-width rows. */
const LIST_CLASS: Record<DescriptionRowLayout, string> = {
  split: "divide-y divide-line",
  review: "divide-y divide-line",
  stacked: "",
  block: "",
  fact: "space-y-1",
};

/** Label and value rows for receipts, payout statements, booking facts and review cards. */
export function DescriptionList({ items, className = "", rowLayout }: DescriptionListProps) {
  if (rowLayout) {
    return (
      <dl className={`${LIST_CLASS[rowLayout]} ${className}`.trim() || undefined}>
        {items.map((item) => (
          <DescriptionRow key={item.label} {...item} layout={rowLayout} />
        ))}
      </dl>
    );
  }
  return (
    <dl className={`ez-dl ${className}`.trim()}>
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
