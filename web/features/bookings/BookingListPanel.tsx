"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { LottieFailurePanel } from "@/components/ui/LottieFailurePanel";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { CopyToClipboardButton } from "@/components/ui/CopyToClipboardButton";
import { useToast } from "@/components/ui/Toast";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import type { BookingEventGroup } from "@/features/bookings/groupBookingsByEvent";
import { TablePagination } from "@/components/ui/TablePagination";
import { shortId } from "@/lib/shortId";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";

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
  listOffset?: number;
  listPageSize?: number;
  listTotal?: number;
  listLoadingMore?: boolean;
  onListPrevious?: () => void;
  onListNext?: () => void;
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
  listOffset = 0,
  listPageSize = DEFAULT_LIST_PAGE_SIZE,
  listTotal = 0,
  listLoadingMore = false,
  onListPrevious,
  onListNext,
}: BookingListPanelProps) {
  const { showToast } = useToast();

  const copyBookingRef = () => {
    showToast({ title: "Booking reference copied", tone: "success" });
  };

  const renderRow = (row: BookingListRowViewModel, options?: { compact?: boolean }) => {
    const compact = options?.compact ?? false;
    const sel = selectedId === row.id;
    const hint = row.warningBadge || row.pendingSubtext || row.reviewLine || null;
    const metaLine = compact
      ? null
      : [row.counterpartyLine, row.dateLabel].filter(Boolean).join(" · ");

    return (
      <li key={row.id}>
        <button
          type="button"
          onClick={() => onSelect(row.id)}
          aria-current={sel}
          className={`relative w-full text-left transition duration-150 ease-out ${
            compact ? "px-5 py-4 sm:px-6 sm:py-5" : "px-5 py-5 sm:px-6 sm:py-6"
          } ${sel ? "bg-primary/[0.05]" : "hover:bg-neutral-50/90"}`}
        >
          {sel ? (
            <span
              className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-primary"
              aria-hidden
            />
          ) : null}

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
                {compact ? row.counterpartyLine : row.eventName}
              </p>
              {metaLine ? (
                <p className="mt-1 truncate text-sm text-neutral-500">{metaLine}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <CopyToClipboardButton
                text={row.id}
                ariaLabel={`Copy booking reference ${shortId(row.id) ?? ""}`}
                onCopied={copyBookingRef}
              />
              <StatusBadge status={row.status} />
            </div>
          </div>

          <p className={`${compact ? "mt-2" : "mt-3"} text-sm font-semibold tabular-nums text-neutral-900`}>
            {row.totalLabel}
          </p>

          {hint ? (
            <p
              className={`mt-2 text-[13px] leading-snug ${
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
            variant="bookings"
            title={emptyTitle}
          />
        ) : eventGroups && eventGroups.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {eventGroups.map((group) =>
              group.bookingCount > 1 ? (
                <section key={group.key}>
                  <div className="border-b border-neutral-100 bg-neutral-50/90 px-5 py-3 sm:px-6">
                    <p className="text-sm font-semibold text-neutral-900">{group.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {[
                        group.dateLabel,
                        `${group.bookingCount} ${group.counterpartyNoun}${group.bookingCount === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {group.rows.map((row) => renderRow(row, { compact: true }))}
                  </ul>
                </section>
              ) : (
                <ul key={group.key} className="divide-y divide-neutral-100">
                  {group.rows.map((row) => renderRow(row))}
                </ul>
              ),
            )}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">{rows.map((row) => renderRow(row))}</ul>
        )}
      </div>
      {onListPrevious && onListNext && listTotal > 0 ? (
        <TablePagination
          className="mt-3 shrink-0"
          offset={listOffset}
          limit={listPageSize}
          total={listTotal}
          pageRowCount={rows.length}
          loading={listLoadingMore}
          onPrevious={onListPrevious}
          onNext={onListNext}
        />
      ) : null}
    </div>
  );
}
