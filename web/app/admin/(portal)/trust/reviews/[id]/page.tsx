"use client";

import { useParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminReviewDetailView } from "@/features/admin/reviews/AdminReviewDetailView";

export default function AdminReviewDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  return (
    <AdminConsolePage title="Review detail">
      {id ? <AdminReviewDetailView reviewId={id} /> : <p className="text-sm text-neutral-600">Invalid id.</p>}
    </AdminConsolePage>
  );
}
