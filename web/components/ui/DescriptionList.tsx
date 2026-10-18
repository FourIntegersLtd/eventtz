import type { ReactNode } from "react";

export type DescriptionItem = {
  label: string;
  value: ReactNode;
};

export type DescriptionListProps = {
  items: readonly DescriptionItem[];
  className?: string;
};

/** Label and value rows for receipts, payout statements and booking facts. */
export function DescriptionList({ items, className = "" }: DescriptionListProps) {
  return (
    <dl className={`divide-y divide-line ${className}`.trim()}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
          <dt className="text-sm text-ink-3">{item.label}</dt>
          <dd className="min-w-0 text-right text-sm font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
