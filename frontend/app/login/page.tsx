"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { UnifiedLoginView } from "@/features/auth/UnifiedLoginView";

function AuthSearchParamsFallback() {
  return (
    <main className="min-h-dvh bg-auth-bg px-4 py-10">
      <LoadingState label="Loading…" variant="page" />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthSearchParamsFallback />}>
      <UnifiedLoginView />
    </Suspense>
  );
}
