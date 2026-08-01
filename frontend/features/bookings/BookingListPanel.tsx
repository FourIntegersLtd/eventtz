import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { BookingEventGroup } from "@/features/bookings/groupBookingsByEvent";

/** `closed` covers every booking that's no longer active - completed, declined, and
 * cancelled - with per-row status badges distinguishing the outcome. */
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
  /** When set, rows render under event section headers (client bookings). */
  eventGroups?: BookingEventGroup[] | null;
};

/**
 * Pure list pane - client and vendor feature folders own data fetching and
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
  eventGroups,
}: BookingListPanelProps) {
  const renderRow = (row: BookingListRowViewModel) => {
    const sel = selectedId === row.id;
    const hint =
      row.warningBadge ||
      row.pendingSubtext ||
      (row.initiatorBadgeLabel && row.status !== "pending" ? row.initiatorBadgeLabel : null);

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
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SegmentedControl
        aria-label="Booking status filter"
        options={TAB_OPTIONS}
        value={tab}
        onChange={onTabChange}
      />

      {error ? (
        <LottieFailurePanel
          className="mt-4 shrink-0 py-5"
          title="Couldn't load bookings"
          description={error}
        />
      ) : null}

      <div className="scroll-pane mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        {loading ? (
          <div className="p-5">
            <SkeletonListRows rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            className="border-0 py-14"
            lottie="emptyInbox"
            title={emptyTitle}
          />
        ) : eventGroups && eventGroups.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {eventGroups.map((group) => (
              <section key={group.key}>
                <div className="border-b border-neutral-100 bg-neutral-50/90 px-5 py-3 sm:px-6">
                  <p className="text-sm font-semibold text-neutral-900">{group.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {[group.dateLabel, `${group.bookingCount} vendor${group.bookingCount === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ul className="divide-y divide-neutral-100">{group.rows.map(renderRow)}</ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">{rows.map(renderRow)}</ul>
        )}
      </div>
    </div>
  );
}
