"use client";

import { Ban, CheckCircle2, Clock } from "lucide-react";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { ApprovalCard } from "./vendorDetailsShared";

type Props = {
  vendor: AdminVendorRow;
  busyId: string | null;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => void;
};

export function VendorDetailsApprovalSection({ vendor, busyId, onSetApproval }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
          Change approval
        </h3>
        <p className="mt-0.5 text-[13px] text-neutral-400">
          Last updated{" "}
          {vendor.updated_at
            ? new Date(vendor.updated_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
          {vendor.current_step != null ? ` · Onboarding step ${vendor.current_step}` : null}
        </p>
      </div>

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
    </div>
  );
}
