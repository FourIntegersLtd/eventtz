"use client";

import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  subtitle?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ subtitle, actions }: AdminPageHeaderProps) {
  if (!subtitle && !actions) return null;

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      {subtitle ? (
        <p className="max-w-prose text-sm leading-relaxed text-neutral-600">{subtitle}</p>
      ) : (
        <span />
      )}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
