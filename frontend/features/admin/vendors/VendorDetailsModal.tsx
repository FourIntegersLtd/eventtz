"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Mail } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import {
  fetchAdminVendorInsights,
  type AdminVendorInsights,
  type AdminVendorRow,
} from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { VendorDetailsApprovalSection } from "./VendorDetailsApprovalSection";
import { VendorDetailsInsightsSection } from "./VendorDetailsInsightsSection";
import { VendorDetailsOverviewSection } from "./VendorDetailsOverviewSection";
import {
  buildVendorProfileData,
  TabButton,
  VENDOR_DETAILS_TAB_CONFIG,
  type VendorDetailsTabId,
} from "./vendorDetailsShared";

type VendorDetailsModalProps = {
  vendor: AdminVendorRow | null;
  busyId: string | null;
  onClose: () => void;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

export function VendorDetailsModal({
  vendor,
  busyId,
  onClose,
  onSetApproval,
}: VendorDetailsModalProps) {
  const [tab, setTab] = useState<VendorDetailsTabId>("profile");
  const [insights, setInsights] = useState<AdminVendorInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const profile = vendor ? buildVendorProfileData(vendor) : null;
  const businessName = profile?.businessName ?? "Vendor details";
  const coverUrl = profile?.portfolioUrls[0] ?? null;

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
      {!vendor || !profile ? null : (
        <div className="space-y-6 text-sm">
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl bg-neutral-50 object-contain object-center ring-1 ring-neutral-100"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-700">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm text-neutral-600">
                  <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  {vendor.email ?? "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <VendorApprovalStatusBadge status={vendor.approval_status} />
                  <VendorProfileStatusBadge status={vendor.status} />
                </div>
              </div>
            </div>
            <Link
              href={insights?.explore_path ?? `/client/browse/${vendor.user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start text-sm font-medium text-primary hover:underline sm:self-center"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Public profile
            </Link>
          </div>

          <div
            className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-neutral-200/80 bg-neutral-100/60 p-1 [-webkit-overflow-scrolling:touch]"
            role="tablist"
          >
            {VENDOR_DETAILS_TAB_CONFIG.map(({ id, label, icon }) => (
              <TabButton key={id} active={tab === id} icon={icon} onClick={() => setTab(id)}>
                {label}
              </TabButton>
            ))}
          </div>

          {tab === "profile" ? (
            <VendorDetailsOverviewSection vendor={vendor} profile={profile} />
          ) : null}

          {tab === "insights" ? (
            <VendorDetailsInsightsSection
              vendor={vendor}
              businessName={businessName}
              insights={insights}
              insightsLoading={insightsLoading}
              insightsError={insightsError}
            />
          ) : null}

          {tab === "actions" ? (
            <VendorDetailsApprovalSection
              vendor={vendor}
              busyId={busyId}
              onSetApproval={onSetApproval}
            />
          ) : null}
        </div>
      )}
    </Modal>
  );
}
