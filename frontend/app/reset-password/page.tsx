"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ResetPasswordView } from "@/features/auth/ResetPasswordView";

function Fallback() {
  return (
    <main className="min-h-dvh bg-auth-bg px-4 py-10">
      <LoadingState label="Loading…" variant="page" />
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ResetPasswordView />
    </Suspense>
  );
}
