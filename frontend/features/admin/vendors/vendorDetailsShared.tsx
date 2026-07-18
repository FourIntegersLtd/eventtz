"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Fingerprint,
  Mail,
  Package,
  Shield,
  Star,
  User,
  Building2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import {
  formatMoneyLabel,
  formatPayloadLabel,
  formatPayloadLabels,
  payloadStr,
  payloadStrArr,
} from "./vendorFormatters";

export type VendorDetailsTabId = "profile" | "insights" | "actions";

export const VENDOR_DETAILS_TAB_CONFIG: {
  id: VendorDetailsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "profile", label: "Profile", icon: Briefcase },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "actions", label: "Actions", icon: Shield },
];

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "bg-red-50 text-red-700"
          : "bg-neutral-100 text-neutral-600";

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
          <p className="mt-1.5 font-heading text-xl font-semibold tabular-nums text-neutral-900">{value}</p>
          {sub ? <div className="mt-1 text-xs text-neutral-600">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function BookingStatusBreakdown({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">No bookings recorded yet.</p>;
  }
  return (
    <ul className="space-y-4">
      {entries.map(([status, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={status}>
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={status} />
              <span className="text-sm tabular-nums text-neutral-600">
                {count} <span className="text-neutral-400">({pct}%)</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function QuickLinkRow({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-white"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-neutral-200/80">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {external ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      )}
    </Link>
  );
}

export function ApprovalCard({
  title,
  icon: Icon,
  variant,
  isCurrent,
  disabled,
  loading,
  onClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "primary" | "secondary" | "destructive";
  isCurrent: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const iconTone =
    variant === "primary"
      ? "bg-emerald-50 text-emerald-700"
      : variant === "destructive"
        ? "bg-red-50 text-red-700"
        : "bg-neutral-100 text-neutral-600";

  const ringClass = isCurrent
    ? variant === "primary"
      ? "border-emerald-300 ring-2 ring-emerald-200/80"
      : variant === "destructive"
        ? "border-red-300 ring-2 ring-red-200/80"
        : "border-neutral-300 ring-2 ring-neutral-200/80"
    : "border-neutral-200/80 hover:border-neutral-300 hover:bg-neutral-50/80";

  return (
    <button
      type="button"
      disabled={disabled || isCurrent}
      onClick={onClick}
      className={`flex flex-col items-center gap-3 rounded-xl border bg-white p-5 text-center transition disabled:cursor-default disabled:opacity-100 ${ringClass}`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-medium text-neutral-900">{title}</span>
      {isCurrent ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Active
        </span>
      ) : loading ? (
        <span className="text-xs text-neutral-500">Updating…</span>
      ) : (
        <span className="text-xs text-neutral-500">Select</span>
      )}
    </button>
  );
}

export function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80" : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {children}
    </button>
  );
}

export function ProfileSection({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-neutral-200/80 bg-white p-5 ${className}`.trim()}>
      <h3 className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
      </h3>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function ProfileField({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-neutral-500">{label}</dt>
        <dd className={`mt-1 text-sm text-neutral-900 ${mono ? "break-all font-mono text-xs" : ""}`.trim()}>
          {value}
        </dd>
      </div>
    </div>
  );
}

export function TagPills({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-sm text-neutral-500">—</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RateCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const display = formatMoneyLabel(value);
  const empty = display === "—";
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 px-5 py-4">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 font-heading text-2xl font-semibold tabular-nums ${empty ? "text-neutral-400" : "text-neutral-900"}`}>
        {display}
      </p>
    </div>
  );
}

export function PackageRow({
  title,
  price,
  duration,
}: {
  title: string;
  price: string;
  duration: string;
}) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-neutral-100 py-3.5 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{title}</p>
        {duration !== "—" ? <p className="mt-0.5 text-xs text-neutral-500">{duration}</p> : null}
      </div>
      <p className="shrink-0 font-semibold tabular-nums text-neutral-900">{price}</p>
    </li>
  );
}

export type VendorProfileData = {
  businessName: string;
  p: Record<string, unknown>;
  packages: unknown[];
  portfolioUrls: string[];
  services: string[];
  eventTypes: string[];
  travelPolicy: string;
  deliveryModes: string[];
  phone: string;
  contactName: string;
  payloadEmail: string;
  loginEmail: string;
  travelRadiusLabel: string;
  socialLinks: string[];
};

export function buildVendorProfileData(vendor: AdminVendorRow): VendorProfileData {
  const p = vendor.payload ?? {};
  const packages = Array.isArray(p.packages) ? p.packages : [];
  const businessName = payloadStr(vendor.payload ?? {}, "businessName") || "Vendor details";
  const portfolioUrls = portfolioImageUrlsFromPayload(p);
  const services = formatPayloadLabels(payloadStrArr(p, "servicesOffered"));
  const eventTypes = formatPayloadLabels(payloadStrArr(p, "eventTypes"));
  const travelPolicy = formatPayloadLabel(payloadStr(p, "travelDeliveryPolicy"));
  const deliveryModes = formatPayloadLabels(payloadStrArr(p, "deliveryModes"));
  const phone = payloadStr(p, "phone");
  const contactName = [payloadStr(p, "firstName"), payloadStr(p, "lastName")].filter(Boolean).join(" ");
  const payloadEmail = payloadStr(p, "email");
  const loginEmail = vendor.email || payloadEmail || "—";
  const travelRadius = payloadStr(p, "travelRadius");
  const travelRadiusLabel = travelRadius ? `${travelRadius} miles` : "—";
  const socialLinks = Array.isArray(p.socialLinks)
    ? p.socialLinks
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const o = row as Record<string, unknown>;
          const platform = formatPayloadLabel(payloadStr(o, "platform"));
          const handle = payloadStr(o, "handle");
          if (!handle) return null;
          return `${platform}: ${handle}`;
        })
        .filter((v): v is string => Boolean(v))
    : [];

  return {
    businessName,
    p,
    packages,
    portfolioUrls,
    services,
    eventTypes,
    travelPolicy,
    deliveryModes,
    phone,
    contactName,
    payloadEmail,
    loginEmail,
    travelRadiusLabel,
    socialLinks,
  };
}
