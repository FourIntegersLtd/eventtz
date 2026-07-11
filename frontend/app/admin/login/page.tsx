"use client";

import { Suspense } from "react";
import { AdminLoginView } from "@/features/admin/auth/AdminLoginView";

function AdminLoginFallback() {
  return (
    <main className="min-h-screen bg-[#f5f2f8] px-4 py-10">
      <p className="text-center text-sm text-neutral-600">Loading…</p>
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
