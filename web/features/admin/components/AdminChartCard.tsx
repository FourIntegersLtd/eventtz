"use client";

import type { ReactNode } from "react";
import Link from "next/link";
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
    <section className={`ez-card flex flex-col ${className}`.trim()}>
      <div className="ez-card__head">
        <div className="min-w-0">
          <h2 className="ez-h3">{title}</h2>
          {subtitle ? <p className="ez-small">{subtitle}</p> : null}
        </div>
        {info ? <AdminInfoHint label={title} info={info} /> : null}
      </div>
      <div className="ez-card__body min-h-[220px] flex-1">{children}</div>
      {footerHref && footerLabel ? (
        <div className="ez-card__foot" style={{ justifyContent: "flex-start" }}>
          <Link href={footerHref} className="ez-link ez-small">
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
