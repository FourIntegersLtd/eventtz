"use client";

import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminVendorsTable } from "@/features/admin/vendors/AdminVendorsTable";
import { useAdminVendors } from "@/features/admin/vendors/useAdminVendors";
import { VendorDetailsModal } from "@/features/admin/vendors/VendorDetailsModal";

export function AdminVendorsView() {
  const {
    rows,
    loading,
    error,
    busyId,
    selectedVendor,
    setSelectedUserId,
    setApproval,
  } = useAdminVendors();

  if (loading) {
    return <AdminLoadingState label="Loading vendors…" />;
  }

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader />
      <AdminVendorsTable rows={rows} onSelect={setSelectedUserId} />
      <VendorDetailsModal
        vendor={selectedVendor}
        busyId={busyId}
        onClose={() => setSelectedUserId(null)}
        onSetApproval={(userId, status) => void setApproval(userId, status)}
      />
    </div>
  );
}
