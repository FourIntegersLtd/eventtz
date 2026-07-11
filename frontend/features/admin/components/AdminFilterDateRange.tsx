"use client";

import type { ReactNode } from "react";

/** Keeps a from/to date pair stacked on mobile; two columns on md; inline on lg+ filter bars. */
export function AdminFilterDateRange({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 md:grid-cols-2 lg:contents">
      {children}
    </div>
  );
}
