"use client";

import { Ban, CheckCircle2, Clock, Package } from "lucide-react";
import { VendorApprovalStatusBadge } from "@/components/ui/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/ui/VendorProfileStatusBadge";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { ApprovalCard, ProfileSection } from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  busyId: string | null;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

export function VendorDetailsApprovalSection({ vendor, busyId, onSetApproval }: Props) {
  return (
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
  );
}
