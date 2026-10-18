"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAdminVendor,
  patchVendorApproval,
  patchVendorListingMedia,
  patchVendorListingOverride,
  patchVendorUnsubmit,
  restoreAdminVendorStripeConnect,
  type AdminListingMediaSavePayload,
  type AdminVendorRow,
  type AdminVendorUnsubmitResult,
} from "@/lib/adminVendorsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { COULD_NOT_RESTORE_STRIPE_CONNECT } from "@/lib/admin-messages";
import type { VendorApprovalStatus, VendorListingOverride } from "@/lib/domain-types";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

/**
 * One vendor's admin page: loads the vendor and runs the staff actions on it,
 * reloading the vendor after each so the page shows the stored state.
 */
export function useAdminVendorDetail(userId: string) {
  const { showToast } = useToast();
  const [vendor, setVendor] = useState<AdminVendorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchAdminVendor(userId)
        .then((loaded) => {
          setVendor(loaded);
          setNotFound(false);
        })
        .catch((e: unknown) => {
          const status = (e as { response?: { status?: number } })?.response?.status;
          if (status === 404) setNotFound(true);
          else setError("Could not load this vendor.");
        })
        .finally(() => setLoading(false)),
    [userId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const setApproval = useCallback(
    async (vendorUserId: string, approval_status: VendorApprovalStatus) => {
      setBusyId(vendorUserId);
      setError(null);
      try {
        await patchVendorApproval(vendorUserId, approval_status);
        track(MixpanelEvents.admin_vendor_approval_set, {
          vendor_user_id: vendorUserId,
          approval_status,
        });
        await load();
        const labels: Record<VendorApprovalStatus, string> = {
          pending: "Vendor moved to pending review",
          approved: "Vendor approved",
          banned: "Vendor banned",
        };
        showToast({ title: labels[approval_status], tone: "success" });
        return true;
      } catch (e) {
        const message = getApiErrorDetail(e) ?? "Could not update approval.";
        setError(message);
        showToast({ title: "Approval update failed", description: message, tone: "error" });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const setListingOverride = useCallback(
    async (vendorUserId: string, listing_override: VendorListingOverride, reason?: string) => {
      setBusyId(vendorUserId);
      setError(null);
      try {
        await patchVendorListingOverride(vendorUserId, listing_override, reason);
        track(MixpanelEvents.admin_vendor_listing_override_set, {
          vendor_user_id: vendorUserId,
          listing_override,
        });
        await load();
        const labels: Record<VendorListingOverride, string> = {
          auto: "Listing set to automatic",
          visible: "Vendor published on marketplace",
          hidden: "Vendor hidden from marketplace",
        };
        showToast({ title: labels[listing_override], tone: "success" });
        return true;
      } catch (e) {
        const message = getApiErrorDetail(e) ?? "Could not update listing visibility.";
        setError(message);
        showToast({ title: "Listing update failed", description: message, tone: "error" });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const setListingMedia = useCallback(
    async (vendorUserId: string, payload: AdminListingMediaSavePayload) => {
      setBusyId(vendorUserId);
      setError(null);
      try {
        await patchVendorListingMedia(vendorUserId, payload);
        await load();
        showToast({
          title:
            payload.displayOrder.length === 0 && payload.hiddenImageUrls.length === 0
              ? "Listing photos reset"
              : "Listing photos updated",
          tone: "success",
        });
        return true;
      } catch (e) {
        const message = getApiErrorDetail(e) ?? "Could not update listing photos.";
        setError(message);
        showToast({ title: "Update failed", description: message, tone: "error" });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const restoreStripeConnect = useCallback(
    async (vendorUserId: string) => {
      setBusyId(vendorUserId);
      setError(null);
      try {
        await restoreAdminVendorStripeConnect(vendorUserId);
        await load();
        showToast({ title: "Stripe Connect restored", tone: "success" });
        return true;
      } catch (e) {
        setError(getApiErrorDetail(e) ?? COULD_NOT_RESTORE_STRIPE_CONNECT);
        throw e;
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const unsubmitVendor = useCallback(
    async (
      vendorUserId: string,
      options?: { message?: string },
    ): Promise<AdminVendorUnsubmitResult | null> => {
      setBusyId(vendorUserId);
      setError(null);
      try {
        const result = await patchVendorUnsubmit(vendorUserId, { message: options?.message });
        await load();
        return result;
      } catch (e) {
        setError(getApiErrorDetail(e) ?? "Could not return vendor to draft.");
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const reportError = useCallback((message: string) => {
    setError(message);
  }, []);

  return {
    vendor,
    loading,
    notFound,
    error,
    busyId,
    setApproval,
    setListingOverride,
    setListingMedia,
    restoreStripeConnect,
    unsubmitVendor,
    reportError,
  };
}
