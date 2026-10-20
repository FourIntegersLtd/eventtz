"use client";

type TablePaginationProps = {
  offset: number;
  limit: number;
  total: number;
  /** Rows on the current page (may be less than limit on the last page). */
  pageRowCount?: number;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

/** Standard prev/next pager for admin and portal tables (offset/limit APIs). */
export function TablePagination({
  offset,
  limit,
  total,
  pageRowCount,
  loading = false,
  onPrevious,
  onNext,
  className = "",
}: TablePaginationProps) {
  if (total <= 0) return null;

  const rowsOnPage = pageRowCount ?? Math.min(limit, Math.max(0, total - offset));
  const pageStart = rowsOnPage > 0 ? offset + 1 : 0;
  const pageEnd = offset + rowsOnPage;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className={`ez-between ${className}`.trim()}>
      <span className="ez-caption">
        Showing {pageStart}-{pageEnd} of {total}
      </span>
      <div className="ez-hrow">
        <button
          type="button"
          disabled={!canPrev || loading}
          onClick={onPrevious}
          className="ez-btn ez-btn--secondary ez-btn--sm"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!canNext || loading}
          onClick={onNext}
          className="ez-btn ez-btn--secondary ez-btn--sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
