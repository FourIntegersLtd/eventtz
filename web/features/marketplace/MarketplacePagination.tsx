"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

/** Fixed square footprint for page-number buttons; 44px keeps them touch friendly. */
const squareBtn = "!px-0 min-w-11";

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
      <Button
        variant="secondary"
        size="sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={squareBtn}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </Button>
      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="inline-flex h-11 w-8 items-center justify-center text-sm text-ink-3"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "primary" : "secondary"}
            size="sm"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
            className={squareBtn}
          >
            {item}
          </Button>
        ),
      )}
      <Button
        variant="secondary"
        size="sm"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={squareBtn}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </Button>
    </nav>
  );
}
