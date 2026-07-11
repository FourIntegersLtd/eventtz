"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
  Images,
  Mail,
  MapPin,
  Package,
  PartyPopper,
  Phone,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Truck,
  User,
  Building2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { StarRating } from "@/components/ui/StarRating";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import { VendorPortfolioThumbGrid } from "@/components/vendor/VendorPortfolioThumbGrid";
import {
  fetchAdminVendorInsights,
  type AdminVendorInsights,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import {
  formatMoneyLabel,
  formatPayloadLabel,
  formatPayloadLabels,
  payloadStr,
  payloadStrArr,
} from "./vendorFormatters";
import { adminTrustReviewsHref } from "@/features/admin/reviews/reviewFormatters";

type VendorDetailsModalProps = {
  vendor: AdminVendorRow | null;
  busyId: string | null;
  onClose: () => void;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

type TabId = "profile" | "insights" | "actions";

const TAB_CONFIG: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profile", icon: Briefcase },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "actions", label: "Actions", icon: Shield },
];

function StatCard({
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

function BookingStatusBreakdown({ byStatus }: { byStatus: Record<string, number> }) {
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

function QuickLinkRow({
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

function ApprovalCard({
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

function TabButton({
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

function ProfileSection({
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

function ProfileField({
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

function TagPills({ items }: { items: string[] }) {
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

function RateCard({
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

function PackageRow({
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

export function VendorDetailsModal({
  vendor,
  busyId,
  onClose,
  onSetApproval,
}: VendorDetailsModalProps) {
  const [tab, setTab] = useState<TabId>("profile");
  const p = vendor?.payload ?? {};
  const packages = Array.isArray(p.packages) ? p.packages : [];
  const businessName = payloadStr(vendor?.payload ?? {}, "businessName") || "Vendor details";
  const portfolioUrls = portfolioImageUrlsFromPayload(p);
  const coverUrl = portfolioUrls[0] ?? null;
  const services = formatPayloadLabels(payloadStrArr(p, "servicesOffered"));
  const eventTypes = formatPayloadLabels(payloadStrArr(p, "eventTypes"));
  const travelPolicy = formatPayloadLabel(payloadStr(p, "travelDeliveryPolicy"));
  const deliveryModes = formatPayloadLabels(payloadStrArr(p, "deliveryModes"));
  const phone = payloadStr(p, "phone");
  const contactName = [payloadStr(p, "firstName"), payloadStr(p, "lastName")].filter(Boolean).join(" ");
  const payloadEmail = payloadStr(p, "email");
  const loginEmail = vendor?.email || payloadEmail || "—";
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

  const [insights, setInsights] = useState<AdminVendorInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor?.user_id) {
      setInsights(null);
      setTab("profile");
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    void fetchAdminVendorInsights(vendor.user_id)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch(() => {
        if (!cancelled) {
          setInsights(null);
          setInsightsError("Could not load marketplace stats.");
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendor?.user_id]);

  const initials =
    businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "V";

  return (
    <Modal
      isOpen={Boolean(vendor)}
      onClose={onClose}
      title={businessName}
      maxWidthClassName="max-w-[calc(100vw-2rem)] lg:max-w-4xl"
      footer={
        vendor && tab === "actions" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null
      }
    >
      {!vendor ? null : (
        <div className="space-y-6 text-sm">
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-gradient-to-br from-neutral-50/80 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl bg-neutral-50 object-contain object-center ring-1 ring-neutral-200/80"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-200 text-lg font-bold text-neutral-700">
                  {initials}
                </div>
              )}
              <div>
                <p className="font-heading text-lg font-semibold text-neutral-900">{businessName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-600">
                  <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  {vendor.email ?? "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <VendorApprovalStatusBadge status={vendor.approval_status} />
                  <VendorProfileStatusBadge status={vendor.status} />
                </div>
              </div>
            </div>
            <Link
              href={insights?.explore_path ?? `/client/browse/${vendor.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-neutral-50 sm:self-center"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Public profile
            </Link>
          </div>

          <div
            className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]"
            role="tablist"
          >
            {TAB_CONFIG.map(({ id, label, icon }) => (
              <TabButton key={id} active={tab === id} icon={icon} onClick={() => setTab(id)}>
                {label}
              </TabButton>
            ))}
          </div>

          {tab === "profile" ? (
            <div className="space-y-8">
              <div className="grid gap-8 lg:grid-cols-2">
                <ProfileSection icon={Fingerprint} title="Account">
                  <ProfileField icon={Building2} label="Business name" value={businessName} />
                  {contactName ? (
                    <ProfileField icon={User} label="Contact name" value={contactName} />
                  ) : null}
                  <ProfileField icon={Mail} label="Email" value={loginEmail} />
                  {payloadEmail && payloadEmail !== loginEmail ? (
                    <ProfileField icon={Mail} label="Profile email" value={payloadEmail} />
                  ) : null}
                  <ProfileField icon={Phone} label="Phone" value={phone || "—"} />
                  <ProfileField icon={Fingerprint} label="User id" value={vendor.user_id} mono />
                  {socialLinks.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-neutral-500">Social</p>
                      <ul className="space-y-1 text-sm text-neutral-800">
                        {socialLinks.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </ProfileSection>

                <ProfileSection icon={MapPin} title="Location">
                  <ProfileField icon={MapPin} label="Base city" value={payloadStr(p, "baseCity") || "—"} />
                  <ProfileField icon={Truck} label="Travel radius" value={travelRadiusLabel} />
                  <div>
                    <p className="mb-2 text-xs font-medium text-neutral-500">Delivery modes</p>
                    <TagPills items={deliveryModes} />
                  </div>
                  <ProfileField icon={Truck} label="Travel / delivery policy" value={travelPolicy} />
                </ProfileSection>
              </div>

              <ProfileSection icon={Briefcase} title="Business & services">
                <div className="space-y-5">
                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Services
                    </p>
                    <TagPills items={services} />
                  </div>
                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <PartyPopper className="h-3.5 w-3.5" aria-hidden />
                      Event types
                    </p>
                    <TagPills items={eventTypes} />
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection icon={Clock} title="Rates">
                <div className="grid gap-4 sm:grid-cols-2">
                  <RateCard icon={Clock} label="Hourly" value={payloadStr(p, "hourlyRate")} />
                  <RateCard icon={CalendarDays} label="Daily" value={payloadStr(p, "dailyRate")} />
                </div>
              </ProfileSection>

              {packages.length > 0 ? (
                <ProfileSection icon={Package} title={`Packages (${packages.length})`}>
                  <ul className="rounded-xl border border-neutral-200/80 bg-neutral-50/40 px-5 py-2">
                    {packages.map((pkg, i) => {
                      const row =
                        typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
                      const title = payloadStr(row, "title") || `Package ${i + 1}`;
                      const price = formatMoneyLabel(payloadStr(row, "price"));
                      const duration = payloadStr(row, "duration") || "—";
                      return (
                        <PackageRow
                          key={`${String(row.id ?? i)}`}
                          title={title}
                          price={price}
                          duration={duration}
                        />
                      );
                    })}
                  </ul>
                </ProfileSection>
              ) : null}

              {portfolioUrls.length > 0 ? (
                <ProfileSection icon={Images} title={`Portfolio (${portfolioUrls.length})`}>
                  <VendorPortfolioThumbGrid urls={portfolioUrls} />
                </ProfileSection>
              ) : null}
            </div>
          ) : null}

          {tab === "insights" ? (
            <div className="space-y-8">
              {insightsError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {insightsError}
                </p>
              ) : null}
              {insightsLoading ? (
                <LoadingState label="Loading stats…" variant="inline" />
              ) : insights ? (
                <>
                  <ProfileSection icon={BarChart3} title="Performance overview">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <StatCard
                        icon={Star}
                        label="Avg. rating"
                        tone={insights.review_count > 0 ? "success" : "default"}
                        value={
                          insights.review_count > 0 && insights.review_average != null ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <StarRating rating={Math.round(insights.review_average)} size="md" />
                              <span>{insights.review_average.toFixed(2)}</span>
                            </span>
                          ) : (
                            "—"
                          )
                        }
                        sub={
                          insights.review_count > 0
                            ? `${insights.review_count} visible review${insights.review_count === 1 ? "" : "s"}`
                            : "No reviews yet"
                        }
                      />
                      <StatCard
                        icon={Briefcase}
                        label="Total bookings"
                        value={insights.bookings_total}
                        sub={insights.bookings_total === 1 ? "1 booking all time" : `${insights.bookings_total} bookings all time`}
                      />
                      <StatCard
                        icon={AlertTriangle}
                        label="Open disputes"
                        tone={
                          insights.open_disputes_on_bookings > 0
                            ? "danger"
                            : "success"
                        }
                        value={insights.open_disputes_on_bookings}
                        sub={
                          insights.open_disputes_on_bookings > 0
                            ? `${insights.open_disputes_on_bookings} active`
                            : undefined
                        }
                      />
                      <StatCard
                        icon={Package}
                        label="Onboarding"
                        value={`Step ${vendor.current_step ?? "—"}`}
                        sub={<VendorProfileStatusBadge status={vendor.status} />}
                      />
                    </div>
                  </ProfileSection>

                  <ProfileSection icon={ScrollText} title="Bookings breakdown">
                    <BookingStatusBreakdown byStatus={insights.bookings_by_status} />
                  </ProfileSection>

                  <ProfileSection icon={ExternalLink} title="Quick links">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <QuickLinkRow
                        href={insights.explore_path}
                        icon={ExternalLink}
                        label="View public profile"
                        external
                      />
                      <QuickLinkRow
                        href={adminTrustReviewsHref({
                          vendorUserId: vendor.user_id,
                          vendorName: businessName,
                        })}
                        icon={Star}
                        label="View reviews"
                      />
                      {insights.open_disputes_on_bookings > 0 ? (
                        <QuickLinkRow
                          href="/admin/trust?tab=disputes"
                          icon={AlertTriangle}
                          label="Open disputes queue"
                        />
                      ) : null}
                    </div>
                  </ProfileSection>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "actions" ? (
            <div className="space-y-8">
              <div
                className={`rounded-xl border p-5 ${
                  vendor.approval_status === "approved"
                    ? "border-emerald-200/80 bg-emerald-50/40"
                    : vendor.approval_status === "banned"
                      ? "border-red-200/80 bg-red-50/40"
                      : "border-amber-200/80 bg-amber-50/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <VendorApprovalStatusBadge status={vendor.approval_status} />
                  <VendorProfileStatusBadge status={vendor.status} />
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      Last updated
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {vendor.updated_at
                        ? new Date(vendor.updated_at).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <Package className="h-3.5 w-3.5" aria-hidden />
                      Onboarding step
                    </dt>
                    <dd className="mt-1 text-sm text-neutral-900">
                      {vendor.current_step != null ? `Step ${vendor.current_step}` : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <ProfileSection icon={CheckCircle2} title="Change approval">
                <div className="grid gap-3 sm:grid-cols-3">
                  <ApprovalCard
                    title="Approve"
                    icon={CheckCircle2}
                    variant="primary"
                    isCurrent={vendor.approval_status === "approved"}
                    disabled={busyId === vendor.user_id}
                    loading={busyId === vendor.user_id}
                    onClick={() => onSetApproval(vendor.user_id, "approved")}
                  />
                  <ApprovalCard
                    title="Pending"
                    icon={Clock}
                    variant="secondary"
                    isCurrent={vendor.approval_status === "pending"}
                    disabled={busyId === vendor.user_id}
                    loading={busyId === vendor.user_id}
                    onClick={() => onSetApproval(vendor.user_id, "pending")}
                  />
                  <ApprovalCard
                    title="Ban"
                    icon={Ban}
                    variant="destructive"
                    isCurrent={vendor.approval_status === "banned"}
                    disabled={busyId === vendor.user_id}
                    loading={busyId === vendor.user_id}
                    onClick={() => onSetApproval(vendor.user_id, "banned")}
                  />
                </div>
              </ProfileSection>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
