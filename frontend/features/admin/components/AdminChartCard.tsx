"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ContentCard, PanelCard } from "@/components/ui/SectionBlock";
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
    <PanelCard
      className={`flex flex-col ${className}`.trim()}
      title={title}
      description={subtitle}
      trailing={info ? <AdminInfoHint label={title} info={info} /> : undefined}
      bodyClassName="flex min-h-0 flex-1 flex-col pt-0"
    >
      <div className="min-h-[220px] flex-1">{children}</div>
      {footerHref && footerLabel ? (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <Link href={footerHref} className="text-xs font-medium text-primary hover:underline">
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </PanelCard>
  );
}
