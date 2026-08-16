"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Clock, Eye, EyeOff, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContentCard } from "@/components/ui/SectionBlock";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAdminPermissions } from "@/features/admin/useAdminPermissions";
import type { AdminVendorRow } from "@/lib/adminVendorsApi";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import {
  getVendorListingOverride,
  VENDOR_LISTING_OVERRIDE_META,
} from "@/lib/domain-types";
import { VendorMarketplaceStatusBanner } from "./VendorMarketplaceStatusBanner";
import { VendorStripeConnectSection } from "./VendorStripeConnectSection";
import { VendorPanelSection } from "./vendorDetailsPanel";
import { ApprovalCard, VendorActionOptionRow } from "./vendorDetailsShared";
import { formControlClass } from "@/components/ui/tokens";

type Props = {
  vendor: AdminVendorRow;
  busyId: string | null;
  onSetApproval: (userId: string, status: VendorApprovalStatus) => Promise<boolean>;
  onSetListingOverride: (
    userId: string,
    override: VendorListingOverride,
    reason?: string,
  ) => Promise<boolean>;
  onRestoreStripe?: (userId: string) => Promise<boolean>;
};

const APPROVAL_HINTS: Record<VendorApprovalStatus, string> = {
  pending: "Back in the review queue. Profile stays hidden.",
  approved: "Passes review. They still need Stripe unless you publish anyway.",
  banned: "Permanent removal and portal lock-out. Use Hide listing for temporary takedowns.",
};

export function VendorDetailsApprovalSection({
  vendor,
  busyId,
  onSetApproval,
  onSetListingOverride,
  onRestoreStripe,
}: Props) {
  const {
    canApproveVendors,
    canBanVendors,
    canOverrideVendorListing,
    canResetVendorListingOverride,
  } = useAdminPermissions();
  const approved = vendor.approval_status === "approved";
  const payoutsVerified = Boolean(vendor.payouts_verified);
  const currentOverride = getVendorListingOverride(vendor.listing_override);
  const busy = busyId === vendor.user_id;

  const currentApproval: VendorApprovalStatus =
    vendor.approval_status === "approved" || vendor.approval_status === "banned"
      ? vendor.approval_status
      : "pending";

  const [pendingOverride, setPendingOverride] = useState<VendorListingOverride | null>(null);
  const [reason, setReason] = useState("");
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);

  const vendorKey = `${vendor.user_id}:${vendor.approval_status}:${currentOverride}`;
  const [lastVendorKey, setLastVendorKey] = useState(vendorKey);
  if (vendorKey !== lastVendorKey) {
    setLastVendorKey(vendorKey);
    setPendingOverride(null);
    setReason("");
    setBanConfirmOpen(false);
  }

  const draftOverride = pendingOverride ?? currentOverride;
  const listingDirty = pendingOverride !== null && pendingOverride !== currentOverride;
  const needsReason = draftOverride === "visible" || draftOverride === "hidden";
  const canSaveListing = listingDirty && (!needsReason || reason.trim().length > 0);
  const approvingWontPublish = !payoutsVerified && currentOverride !== "visible";

  const applyApproval = async (status: VendorApprovalStatus): Promise<boolean> => {
    if (status === currentApproval) return false;
    return onSetApproval(vendor.user_id, status);
  };

  const selectApproval = (status: VendorApprovalStatus) => {
    if (status === currentApproval || busy) return;
    if (status === "banned") {
      setPendingOverride(null);
      setReason("");
      setBanConfirmOpen(true);
      return;
    }
    void applyApproval(status);
  };

  const selectListing = (override: VendorListingOverride) => {
    if (busy) return;
    if (override === currentOverride) {
      setPendingOverride(null);
      setReason("");
      return;
    }
    if (override === "auto") {
      if (!canResetVendorListingOverride) return;
      setPendingOverride(null);
      setReason("");
      void onSetListingOverride(vendor.user_id, "auto");
      return;
    }
    if (!canOverrideVendorListing) return;
    setPendingOverride(override);
  };

  const saveListing = useCallback(async () => {
    if (!pendingOverride || !canSaveListing) return;
    const ok = await onSetListingOverride(vendor.user_id, pendingOverride, reason);
    if (ok) {
      setPendingOverride(null);
      setReason("");
    }
  }, [canSaveListing, onSetListingOverride, pendingOverride, reason, vendor.user_id]);

  const cancelListingDraft = () => {
    setPendingOverride(null);
    setReason("");
  };

  const showStripeHint =
    approved && !payoutsVerified && currentOverride === "auto" && !listingDirty;

  return (
    <div className={`space-y-6 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <VendorMarketplaceStatusBanner vendor={vendor} />

      <VendorStripeConnectSection
        vendor={vendor}
        busy={busy}
        onRestoreStripe={onRestoreStripe}
      />

      <VendorPanelSection
        title="Review decision"
        description="Whether this vendor has passed admin review"
      >
        {approvingWontPublish ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm leading-relaxed text-amber-900">
              Approving alone won&apos;t make this vendor visible. Clients can only see and book
              them once Stripe verifies their payout details, which happens automatically - or
              you choose <strong>Publish anyway</strong> below.
            </p>
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-3">
          <Tooltip hint={APPROVAL_HINTS.pending} widthClassName="w-60" className="h-full">
            <ApprovalCard
              title="Pending"
              icon={Clock}
              variant="secondary"
              isCurrent={currentApproval === "pending"}
              disabled={busy || !canApproveVendors}
              loading={busy}
              onClick={() => selectApproval("pending")}
            />
          </Tooltip>
          <Tooltip hint={APPROVAL_HINTS.approved} widthClassName="w-60" className="h-full">
            <ApprovalCard
              title="Approve"
              icon={CheckCircle2}
              variant="primary"
              isCurrent={currentApproval === "approved"}
              disabled={busy || !canApproveVendors}
              loading={busy}
              onClick={() => selectApproval("approved")}
            />
          </Tooltip>
          <Tooltip hint={APPROVAL_HINTS.banned} widthClassName="w-60" className="h-full">
            <ApprovalCard
              title="Ban"
              icon={Ban}
              variant="destructive"
              isCurrent={currentApproval === "banned"}
              disabled={busy || !canBanVendors}
              loading={busy}
              onClick={() => selectApproval("banned")}
            />
          </Tooltip>
        </div>
      </VendorPanelSection>

      <ContentCard className="overflow-hidden !p-0">
        <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">Explore listing</h3>
          <p className="mt-0.5 text-xs text-neutral-500">What clients see when browsing vendors</p>
          {showStripeHint ? (
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              Stripe isn&apos;t verified yet, so they stay hidden on Automatic. Use{" "}
              <strong>Publish anyway</strong> if you want them live now.
            </p>
          ) : null}
        </div>
        <div className="space-y-1 p-2 sm:p-3">
          <VendorActionOptionRow
            icon={Wand2}
            title={VENDOR_LISTING_OVERRIDE_META.auto.label}
            description={VENDOR_LISTING_OVERRIDE_META.auto.description}
            selected={draftOverride === "auto"}
            disabled={!canResetVendorListingOverride}
            onSelect={() => selectListing("auto")}
          />
          {canOverrideVendorListing ? (
            <>
              <VendorActionOptionRow
                icon={Eye}
                title={VENDOR_LISTING_OVERRIDE_META.visible.label}
                description={VENDOR_LISTING_OVERRIDE_META.visible.description}
                tone="success"
                selected={draftOverride === "visible"}
                disabled={!approved}
                onSelect={() => selectListing("visible")}
              />
              <VendorActionOptionRow
                icon={EyeOff}
                title={VENDOR_LISTING_OVERRIDE_META.hidden.label}
                description={VENDOR_LISTING_OVERRIDE_META.hidden.description}
                tone="warning"
                selected={draftOverride === "hidden"}
                onSelect={() => selectListing("hidden")}
              />
            </>
          ) : (
            <p className="px-3 py-2 text-xs leading-relaxed text-neutral-500">
              Publish anyway and Hide listing require a super admin. You can still revert to{" "}
              <strong>Automatic</strong> when a listing override is active.
            </p>
          )}
        </div>

        {listingDirty ? (
          <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 sm:px-5">
            {needsReason ? (
              <label className="block">
                <span className="text-xs font-medium text-neutral-700">
                  Reason for audit log
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Brief note on why you're overriding the listing"
                  className={formControlClass("mt-1.5 placeholder:text-neutral-400")}
                />
              </label>
            ) : null}
            {draftOverride === "visible" ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                Clients can book and pay without verified Stripe. Payout still waits for Connect.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={cancelListingDraft}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!canSaveListing || busy}
                loading={busy}
                onClick={() => void saveListing()}
              >
                Save listing
              </Button>
            </div>
          </div>
        ) : null}

        {!approved ? (
          <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
            This vendor is not approved, so they stay hidden regardless of listing setting.
          </p>
        ) : null}
      </ContentCard>

      <ConfirmDialog
        isOpen={banConfirmOpen}
        title="Ban this vendor?"
        description="They will lose portal access and disappear from the marketplace permanently. To hide them temporarily, cancel and choose Hide listing instead."
        confirmLabel="Ban vendor"
        confirmVariant="destructive"
        loading={busy}
        onCancel={() => setBanConfirmOpen(false)}
        onConfirm={() => {
          void applyApproval("banned").then((ok) => {
            if (ok) setBanConfirmOpen(false);
          });
        }}
      />
    </div>
  );
}
