"use client";

import type { ReactNode } from "react";

/** From/to pair: two columns on mobile (fits iOS date inputs); inline on lg+ filter bars. */
export function AdminFilterDateRange({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2 overflow-hidden sm:gap-3 md:gap-3 lg:contents">
      {children}
    </div>
  );
}
