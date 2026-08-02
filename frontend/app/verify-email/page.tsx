"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { VerifyEmailView } from "@/features/auth/VerifyEmailView";

function Fallback() {
  return (
    <main className="min-h-dvh bg-auth-bg px-4 py-10">
      <LoadingState label="Loading…" variant="page" branded />
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <VerifyEmailView />
    </Suspense>
  );
}
