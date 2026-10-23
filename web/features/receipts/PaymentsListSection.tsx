"use client";

import type { ReactNode } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { TablePagination } from "@/components/ui/TablePagination";

/** The slice of `useServerList` the section reads: position, size, state and the pager callbacks. */
export type PaymentsListState = {
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  error: string | null;
  itemCount: number;
  goNext: () => void;
  goPrevious: () => void;
};

type PaymentsListSectionProps = {
  list: PaymentsListState;
  /** Shown while the first page loads. */
  loadingLabel: string;
  /** Shown instead of the rows when the list has nothing to show at all. */
  empty: ReactNode;
  /** True when the list is empty because nothing exists, not because a filter excluded everything. */
  isEmpty: boolean;
  /** The rows (a table or a list) for the current page. */
  children: ReactNode;
};

/**
 * The loading, error, empty and paging frame shared by the client payment history and the vendor
 * payouts list, so both money lists behave the same way for one server page at a time.
 */
export function PaymentsListSection({ list, loadingLabel, empty, isEmpty, children }: PaymentsListSectionProps) {
  if (list.loading && list.itemCount === 0 && !list.error) {
    return <LoadingState label={loadingLabel} variant="inline" />;
  }
  if (list.error) {
    return <LottieFailureInline message={list.error} />;
  }
  if (isEmpty) {
    return <>{empty}</>;
  }
  return (
    <div className="ez-stack ez-stack--lg">
      {children}
      <TablePagination
        offset={list.offset}
        limit={list.limit}
        total={list.total}
        pageRowCount={list.itemCount}
        loading={list.loading}
        onPrevious={list.goPrevious}
        onNext={list.goNext}
      />
    </div>
  );
}
