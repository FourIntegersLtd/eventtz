"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { adminCard } from "@/features/admin/adminTheme";

type AdminKpiTone = "default" | "warning" | "info" | "success" | "primary";

const ICON_TONE_CLASSES: Record<AdminKpiTone, string> = {
  default: "bg-neutral-100 text-neutral-500",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
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
};

export function AdminKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  linkLabel,
}: AdminKpiCardProps) {
  return (
    <div className={`${adminCard} p-4`}>
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
              className="mt-2 inline-block text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:underline"
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
