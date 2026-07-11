"use client";

import type { ReactNode } from "react";

type AdminFilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function AdminFilterBar({ children, className = "" }: AdminFilterBarProps) {
  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-3 sm:flex-row sm:flex-wrap sm:items-end ${className}`.trim()}
    >
      {children}
    </div>
  );
}
