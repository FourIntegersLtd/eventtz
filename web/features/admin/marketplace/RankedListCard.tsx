import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { AdminInfoHint, type AdminChartInfo } from "@/features/admin/components/AdminInfoHint";

/** One ranked row: its label (and optional second line) on the left, a caller-built figure block on the right. */
export type RankedListRow = {
  key: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing: ReactNode;
};

type RankedListCardProps = {
  title: string;
  subtitle: string;
  /** Copy for the info hint beside the title. */
  info: AdminChartInfo;
  emptyMessage: string;
  rows: RankedListRow[];
};

/** Numbered list card used by the admin marketplace analytics "Top locations" and "Top vendors". */
export function RankedListCard({ title, subtitle, info, emptyMessage, rows }: RankedListCardProps) {
  return (
    <Card as="section" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>
        </div>
        <AdminInfoHint label={title} info={info} />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-ink-3">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-4 shrink-0 text-xs tabular-nums text-ink-3">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-ink">{row.title}</p>
                  {row.subtitle ? <p className="text-xs text-ink-3">{row.subtitle}</p> : null}
                </div>
              </div>
              <div className="shrink-0 text-right">{row.trailing}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
