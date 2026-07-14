"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type MarketplacePaginationProps = {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

/** Compact window of page numbers around the current page (max 5 digits + ends). */
function pageItems(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let n = start; n <= end; n++) items.push(n);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

const squareBtn =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

export function MarketplacePagination({
  page,
  totalCount,
  pageSize,
  onPageChange,
}: MarketplacePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount <= pageSize) return null;

  const items = pageItems(page, totalPages);

  return (
    <nav
      aria-label="Browse pages"
      className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={`${squareBtn} border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50`}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>
      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="inline-flex h-10 w-8 items-center justify-center text-sm text-neutral-400"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
            className={
              item === page
                ? `${squareBtn} border-primary/20 bg-primary-muted text-primary`
                : `${squareBtn} border-neutral-200 bg-white text-neutral-700 hover:border-primary/15 hover:bg-primary-soft/60`
            }
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={`${squareBtn} border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50`}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </nav>
  );
}
