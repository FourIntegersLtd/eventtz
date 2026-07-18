"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { adminCard } from "@/features/admin/adminTheme";
import {
  AdminInfoHint,
  type AdminChartInfo,
} from "@/features/admin/components/AdminInfoHint";

export type { AdminChartInfo };

type AdminChartCardProps = {
  title: string;
  subtitle?: string;
  /** Opens an info modal so admins know what they are looking at. */
  info?: AdminChartInfo;
  footerHref?: string;
  footerLabel?: string;
  children: ReactNode;
  className?: string;
};

export function AdminChartCard({
  title,
  subtitle,
  info,
  footerHref,
  footerLabel,
  children,
  className = "",
}: AdminChartCardProps) {
  return (
    <section className={`${adminCard} flex flex-col p-4 sm:p-5 ${className}`.trim()}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {info ? <AdminInfoHint label={title} info={info} /> : null}
      </div>
      <div className="min-h-[220px] flex-1">{children}</div>
      {footerHref && footerLabel ? (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <Link href={footerHref} className="text-xs font-medium text-primary hover:underline">
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
