"use client";

import type { ReactNode } from "react";

/** From/to pair: stacked on mobile/tablet (full-width pickers); inline on lg+ filter bars via `lg:contents`. */
export function AdminFilterDateRange({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 lg:contents">
      {children}
    </div>
  );
}
