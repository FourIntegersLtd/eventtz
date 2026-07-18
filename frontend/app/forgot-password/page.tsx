"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { ForgotPasswordView } from "@/features/auth/ForgotPasswordView";

function Fallback() {
  return (
    <main className="min-h-dvh bg-auth-bg px-4 py-10">
      <LoadingState label="Loading…" variant="page" />
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ForgotPasswordView />
    </Suspense>
  );
}
