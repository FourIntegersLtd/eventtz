"use client";

type MarketplacePaginationProps = {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

import { marketplacePaginationWindow } from "./marketplacePaginationWindow";

const squareBtn = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40";

export function MarketplacePagination({ page, totalCount, pageSize, onPageChange }: MarketplacePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount <= pageSize) return null;
  const list = marketplacePaginationWindow(page, totalPages);

  return (
    <nav aria-label="Browse pages" className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
        className={`${squareBtn} border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50`}>
        <span aria-hidden>&larr;</span>
      </button>
      {list.map((item, idx) => item === "ellipsis" ? (
        <span key={`e-${idx}`} className="inline-flex h-10 w-8 items-center justify-center text-sm text-neutral-400" aria-hidden>&hellip;</span>
      ) : (
        <button key={item as number} type="button" aria-label={`Page ${item}`} aria-current={item === page ? "page" : undefined}
          onClick={() => onPageChange(item as number)}
          className={item === page
            ? `${squareBtn} border-primary/20 bg-primary-muted text-primary`
            : `${squareBtn} border-neutral-200 bg-white text-neutral-700 hover:border-primary/15 hover:bg-primary-soft/60`}>
          {item}
        </button>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
        className={`${squareBtn} border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50`}>
        <span aria-hidden>&rarr;</span>
      </button>
    </nav>
  );
}
