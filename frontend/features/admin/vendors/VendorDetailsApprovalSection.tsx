"use client";

import { Ban, CheckCircle2, Clock } from "lucide-react";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { VendorPanelCard, VendorPanelSection } from "./vendorDetailsPanel";
import { ApprovalCard } from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  busyId: string | null;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

export function VendorDetailsApprovalSection({ vendor, busyId, onSetApproval }: Props) {
  const lastUpdated = vendor.updated_at
    ? new Date(vendor.updated_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

  const onboardingNote =
    vendor.current_step != null ? ` · Onboarding step ${vendor.current_step}` : "";

  return (
    <div className="space-y-8">
      <VendorPanelSection
        title="Current status"
        description="Approval and profile state before you make a change"
      >
        <VendorPanelCard>
          <dl className="divide-y divide-neutral-100">
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
              <dt className="text-[13px] text-neutral-500">Approval</dt>
              <dd>
                <VendorApprovalStatusBadge status={vendor.approval_status} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
              <dt className="text-[13px] text-neutral-500">Profile</dt>
              <dd>
                <VendorProfileStatusBadge status={vendor.status} />
              </dd>
            </div>
            <div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <dt className="text-[13px] text-neutral-500">Last updated</dt>
              <dd className="text-sm text-neutral-800">
                {lastUpdated}
                {onboardingNote ? (
                  <span className="text-neutral-500">{onboardingNote}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </VendorPanelCard>
      </VendorPanelSection>

      <VendorPanelSection
        title="Change approval"
        description="Approve for marketplace, return to pending review, or ban the vendor"
      >
        <div className="grid gap-5 sm:grid-cols-3">
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
      </VendorPanelSection>
    </div>
  );
}
