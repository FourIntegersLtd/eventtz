import {
  Calendar,
  CalendarClock,
  MessageSquareQuote,
  Star,
  User,
  Wallet,
} from "lucide-react";
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

      <div className="scroll-pane mt-4 min-h-0 flex-1 rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/50">
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
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-current={sel}
                    className={`relative w-full px-5 py-5 text-left transition duration-150 ease-out hover:bg-neutral-50 ${
                      sel ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    {sel ? (
                      <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-heading text-base font-semibold leading-snug text-neutral-900 line-clamp-2">
                        {row.eventName}
                      </p>
                      <div className="mt-0.5 flex flex-col items-end gap-1">
                        <StatusBadge status={row.status} />
                        {row.status === "pending" && row.initiatorBadgeLabel ? (
                          <span className="text-[10px] font-medium text-neutral-500">
                            Waiting for client
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="flex items-center gap-2 text-sm text-neutral-700">
                        <User className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span className="min-w-0 truncate">{row.counterpartyLine}</span>
                      </p>

                      {row.initiatorBadgeLabel && row.status !== "pending" ? (
                        <p className="flex items-center gap-2 text-xs font-medium text-primary">
                          <MessageSquareQuote
                            className="h-3.5 w-3.5 shrink-0 text-primary/70"
                            aria-hidden
                          />
                          <span>{row.initiatorBadgeLabel}</span>
                        </p>
                      ) : null}

                      <p className="flex items-center gap-2 text-sm text-neutral-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span>{row.dateLabel}</span>
                      </p>

                      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <Wallet className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span className="tabular-nums">{row.totalLabel}</span>
                      </p>
                    </div>

                    {row.reviewLine ? (
                      <p className="mt-4 flex items-start gap-2 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-600">
                        <Star
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{row.reviewLine}</span>
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
