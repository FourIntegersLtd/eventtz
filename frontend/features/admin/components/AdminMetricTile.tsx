"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type Highlight = "default" | "warning";

export function AdminMetricTile({
  label,
  value,
  icon: Icon,
  hint,
  highlight = "default",
  footerLink,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  hint?: string;
  highlight?: Highlight;
  footerLink?: { href: string; label: string };
}) {
  const surface =
    highlight === "warning"
      ? "border-amber-200/90 bg-amber-50/60 ring-1 ring-amber-200/50"
      : "border-neutral-200 bg-white";

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${surface}`}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              highlight === "warning"
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-neutral-900">
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-neutral-500">{hint}</p> : null}
          {footerLink ? (
            <Link
              href={footerLink.href}
              className="mt-2 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              {footerLink.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
