"use client";

import type { ReactNode } from "react";

type AdminFilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function AdminFilterBar({ children, className = "" }: AdminFilterBarProps) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
