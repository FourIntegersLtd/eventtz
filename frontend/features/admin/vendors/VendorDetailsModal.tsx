"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  ExternalLink,
  MapPin,
  Package,
  Star,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StarRating } from "@/components/ui/StarRating";
import { VendorPortfolioThumbGrid } from "@/components/vendor/VendorPortfolioThumbGrid";
import {
  fetchAdminVendorInsights,
  type AdminVendorInsights,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { portfolioImageUrlsFromPayload } from "@/lib/vendorPortfolioImages";
import { approvalLabel, payloadStr, payloadStrArr } from "./vendorFormatters";

type VendorDetailsModalProps = {
  vendor: AdminVendorRow | null;
  busyId: string | null;
  onClose: () => void;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

type TabId = "profile" | "insights" | "actions";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-neutral-500">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80" : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
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
  const prettyPayload = JSON.stringify(p, null, 2);
  const businessName = payloadStr(vendor?.payload ?? {}, "businessName") || "Vendor details";
  const portfolioUrls = portfolioImageUrlsFromPayload(p);
  const coverUrl = portfolioUrls[0] ?? null;

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

  const approvalBadge =
    vendor?.approval_status === "approved"
      ? "bg-emerald-100 text-emerald-900"
      : vendor?.approval_status === "banned"
        ? "bg-red-100 text-red-900"
        : "bg-amber-100 text-amber-900";

  return (
    <Modal
      isOpen={Boolean(vendor)}
      onClose={onClose}
      title={businessName}
      maxWidthClassName="max-w-[calc(100vw-2rem)] lg:max-w-4xl"
      footer={
        vendor && tab === "actions" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalBadge}`}>
              {approvalLabel(vendor.approval_status)}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === vendor.user_id}
                onClick={() => onSetApproval(vendor.user_id, "approved")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === vendor.user_id}
                onClick={() => onSetApproval(vendor.user_id, "pending")}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
              >
                Set pending
              </button>
              <button
                type="button"
                disabled={busyId === vendor.user_id}
                onClick={() => onSetApproval(vendor.user_id, "banned")}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Ban
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {!vendor ? null : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl bg-neutral-50 object-contain object-center ring-1 ring-neutral-200/80"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-200 text-base font-bold text-neutral-700">
                  {initials}
                </div>
              )}
              <div>
                <p className="font-heading font-semibold text-neutral-900">{businessName}</p>
                <p className="text-sm text-neutral-600">{vendor.email ?? "—"}</p>
              </div>
            </div>
            <Link
              href={insights?.explore_path ?? `/client/browse/${vendor.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-neutral-50"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Public profile
            </Link>
          </div>

          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]" role="tablist">
            <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
              Profile
            </TabButton>
            <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
              Insights
            </TabButton>
            <TabButton active={tab === "actions"} onClick={() => setTab("actions")}>
              Actions
            </TabButton>
          </div>

          {tab === "profile" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-neutral-200/80 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <MapPin className="h-4 w-4 text-neutral-400" aria-hidden />
                    Location & contact
                  </h3>
                  <dl className="mt-3 space-y-2 text-neutral-800">
                    <div>
                      <dt className="text-xs text-neutral-500">Base city</dt>
                      <dd>{payloadStr(p, "baseCity") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Email</dt>
                      <dd className="break-all">{vendor.email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">User id</dt>
                      <dd className="break-all font-mono text-xs">{vendor.user_id}</dd>
                    </div>
                  </dl>
                </section>
                <section className="rounded-xl border border-neutral-200/80 p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">Business & services</h3>
                  <dl className="mt-3 space-y-2 text-neutral-800">
                    <div>
                      <dt className="text-xs text-neutral-500">Services</dt>
                      <dd>{payloadStrArr(p, "servicesOffered").join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Event types</dt>
                      <dd>{payloadStrArr(p, "eventTypes").join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-500">Travel / delivery</dt>
                      <dd>{payloadStr(p, "travelDeliveryPolicy") || "—"}</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <section className="rounded-xl border border-neutral-200/80 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Pricing & packages</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-neutral-500">Hourly</p>
                    <p>{payloadStr(p, "hourlyRate") || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Daily</p>
                    <p>{payloadStr(p, "dailyRate") || "—"}</p>
                  </div>
                </div>
                {packages.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">No packages submitted.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {packages.map((pkg, i) => {
                      const row =
                        typeof pkg === "object" && pkg !== null ? (pkg as Record<string, unknown>) : {};
                      return (
                        <li key={`${String(row.id ?? i)}`} className="rounded-lg bg-neutral-50 px-3 py-2">
                          <p className="font-medium">{payloadStr(row, "title") || `Package ${i + 1}`}</p>
                          <p className="text-xs text-neutral-600">
                            {payloadStr(row, "price") || "—"} · {payloadStr(row, "duration") || "—"}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              {portfolioUrls.length > 0 ? (
                <section className="rounded-xl border border-neutral-200/80 p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Portfolio ({portfolioUrls.length})
                  </h3>
                  <VendorPortfolioThumbGrid urls={portfolioUrls} />
                </section>
              ) : null}
              <details className="rounded-xl border border-neutral-200">
                <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-neutral-600">
                  Raw profile payload
                </summary>
                <pre className="max-h-[200px] overflow-auto border-t border-neutral-200 p-3 text-xs">{prettyPayload}</pre>
              </details>
            </div>
          ) : null}

          {tab === "insights" ? (
            <div className="space-y-4">
              {insightsError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {insightsError}
                </p>
              ) : null}
              {insightsLoading ? (
                <p className="text-sm text-neutral-500">Loading stats…</p>
              ) : insights ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      icon={Star}
                      label="Avg. rating"
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
                    <StatCard icon={Briefcase} label="Total bookings" value={insights.bookings_total} />
                    <StatCard
                      icon={AlertTriangle}
                      label="Open disputes"
                      value={insights.open_disputes_on_bookings}
                    />
                    <StatCard
                      icon={Package}
                      label="Onboarding"
                      value={`Step ${vendor.current_step ?? "—"}`}
                      sub={`Form: ${vendor.status}`}
                    />
                  </div>
                  {Object.keys(insights.bookings_by_status).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(insights.bookings_by_status)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([status, n]) => (
                          <span
                            key={status}
                            className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium"
                          >
                            <span className="capitalize">{status}</span>
                            <span className="ml-2 tabular-nums text-neutral-600">{n}</span>
                          </span>
                        ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "actions" ? (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Change approval status for this vendor. Approved vendors appear on client explore; banned vendors are
                hidden from search.
              </p>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-neutral-500">Current status</dt>
                  <dd className="mt-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalBadge}`}>
                      {approvalLabel(vendor.approval_status)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Last updated</dt>
                  <dd className="mt-1">
                    {vendor.updated_at ? new Date(vendor.updated_at).toLocaleString("en-GB") : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
