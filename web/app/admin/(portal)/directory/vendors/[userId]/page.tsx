"use client";

import { useParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminVendorDetailView } from "@/features/admin/vendors/AdminVendorDetailView";

export default function AdminVendorDetailPage() {
  const params = useParams();
  const userId = typeof params?.userId === "string" ? params.userId : "";

  return (
    <AdminConsolePage

      title="Vendor review"
      description="Approve, return for edits, or update listing, insurance, and payout status."
      showPageHead={false}
    >
      {userId ? (
        <AdminVendorDetailView userId={userId} />
      ) : (
        <p className="text-sm text-neutral-600">Invalid id.</p>
      )}
    </AdminConsolePage>
  );
}
