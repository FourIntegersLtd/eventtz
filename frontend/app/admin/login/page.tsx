"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdminLoginView } from "@/features/admin/auth/AdminLoginView";

function AdminLoginFallback() {
  return (
    <main className="min-h-screen bg-[#f5f2f8] px-4 py-10">
      <LoadingState label="Loading…" variant="page" />
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginView />
    </Suspense>
  );
}
