"use client";

import type { ReactNode } from "react";

type AdminFilterBarProps = {
  children: ReactNode;
  className?: string;
};

/** Filter row — stacks full-width on mobile/tablet; wraps horizontally from lg up. */
export function AdminFilterBar({ children, className = "" }: AdminFilterBarProps) {
  return (
    <div
      className={`mb-4 box-border flex w-full min-w-0 max-w-full flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 lg:flex-row lg:flex-wrap lg:items-end ${className}`.trim()}
    >
      {children}
    </div>
  );
}
