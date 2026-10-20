"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type AdminKpiTone = "default" | "warning" | "info" | "success" | "primary";

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
  const body = (
    <>
      <div className="ez-kpi__label">
        {Icon ? <Icon aria-hidden /> : null}
        {label}
      </div>
      <div className="ez-kpi__value">{value}</div>
      {hint ? (
        <div className={tone === "warning" ? "ez-kpi__delta ez-kpi__delta--down" : "ez-small"}>{hint}</div>
      ) : null}
      {href && linkLabel ? (
        <Link href={href} className="ez-link ez-small">
          {linkLabel}
        </Link>
      ) : null}
    </>
  );

  if (href && !linkLabel) {
    return (
      <Link href={href} className="ez-kpi ez-kpi--link">
        {body}
      </Link>
    );
  }

  return <div className="ez-kpi">{body}</div>;
}
