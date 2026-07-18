import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";

/** `closed` covers every booking that's no longer active — completed, declined, and
 * cancelled — with per-row status badges distinguishing the outcome. */
export type BookingListTab = "active" | "closed";

const TAB_OPTIONS: readonly SegmentedControlOption<BookingListTab>[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

type BookingListPanelProps = {
  tab: BookingListTab;
  onTabChange: (tab: BookingListTab) => void;
  rows: BookingListRowViewModel[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyTitle: string;
};

/**
 * Pure list pane — client and vendor feature folders own data fetching and
 * pass in rows already mapped to `BookingListRowViewModel`.
 */
export function BookingListPanel({
  tab,
  onTabChange,
  rows,
  loading,
  error,
  selectedId,
  onSelect,
  emptyTitle,
}: BookingListPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SegmentedControl
        aria-label="Booking status filter"
        options={TAB_OPTIONS}
        value={tab}
        onChange={onTabChange}
      />

      {error ? (
        <p className="mt-4 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="scroll-pane mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonListRows rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            className="border-0 py-14"
            icon={<CalendarClock className="h-8 w-8" strokeWidth={1.5} />}
            title={emptyTitle}
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const sel = selectedId === row.id;
              const hint =
                row.warningBadge ||
                row.pendingSubtext ||
                (row.initiatorBadgeLabel && row.status !== "pending"
                  ? row.initiatorBadgeLabel
                  : null);

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-current={sel}
                    className={`relative w-full px-5 py-6 text-left transition duration-150 ease-out sm:px-6 sm:py-7 ${
                      sel ? "bg-primary/[0.05]" : "hover:bg-neutral-50/90"
                    }`}
                  >
                    {sel ? (
                      <span
                        className="absolute inset-y-4 left-0 w-[3px] rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}

                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
                        {row.eventName}
                      </p>
                      <StatusBadge status={row.status} />
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <p className="truncate text-sm text-neutral-600">{row.counterpartyLine}</p>
                      <p className="text-sm text-neutral-500">{row.dateLabel}</p>
                      <p className="pt-1 text-sm font-semibold tabular-nums text-neutral-900">
                        {row.totalLabel}
                      </p>
                    </div>

                    {hint ? (
                      <p
                        className={`mt-4 text-[13px] leading-snug ${
                          row.warningBadge ? "font-medium text-amber-700" : "text-neutral-500"
                        }`}
                      >
                        {hint}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
