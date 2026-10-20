"use client";

import type { ReactNode } from "react";

type AdminFilterBarProps = {
  children: ReactNode;
  className?: string;
};

/** Filter row (`ez-hrow` of `ez-field` controls). */
export function AdminFilterBar({ children, className = "" }: AdminFilterBarProps) {
  return (
    <div className={`ez-hrow flex-wrap items-end gap-3 ${className}`.trim()} style={{ alignItems: "flex-end" }}>
      {children}
    </div>
  );
}
