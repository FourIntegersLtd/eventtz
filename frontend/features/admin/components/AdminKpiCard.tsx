"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { adminCard } from "@/features/admin/adminTheme";

type AdminKpiTone = "default" | "warning" | "info" | "success" | "primary";

const ICON_TONE_CLASSES: Record<AdminKpiTone, string> = {
  default: "bg-neutral-100 text-neutral-500",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  primary: "bg-primary/10 text-primary",
};

type AdminKpiCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: AdminKpiTone;
  href?: string;
  linkLabel?: string;
  /** Highlight the whole card (e.g. pending approvals needing action). */
  highlight?: boolean;
};

export function AdminKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  linkLabel,
  highlight = false,
}: AdminKpiCardProps) {
  const showHighlight = highlight || tone === "warning";

  return (
    <div
      className={`${adminCard} p-4 ${
        showHighlight ? "border-amber-200/90 bg-amber-50/40 ring-1 ring-amber-100" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-neutral-900">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
          {href && linkLabel ? (
            <Link
              href={href}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {linkLabel}
            </Link>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_TONE_CLASSES[tone]}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}
