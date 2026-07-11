"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { adminCard } from "@/features/admin/adminTheme";

type AdminChartCardProps = {
  title: string;
  subtitle?: string;
  footerHref?: string;
  footerLabel?: string;
  children: ReactNode;
  className?: string;
};

export function AdminChartCard({
  title,
  subtitle,
  footerHref,
  footerLabel,
  children,
  className = "",
}: AdminChartCardProps) {
  return (
    <section className={`${adminCard} flex flex-col p-4 sm:p-5 ${className}`.trim()}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
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
