import { Fragment, type ReactNode } from "react";

export type DescriptionItem = {
  label: string;
  value: ReactNode;
};

export type DescriptionListProps = {
  items: readonly DescriptionItem[];
  className?: string;
};

/** Label and value rows (`ez-dl`) for receipts, payout statements and booking facts. */
export function DescriptionList({ items, className = "" }: DescriptionListProps) {
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
