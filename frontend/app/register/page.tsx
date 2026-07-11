"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { UnifiedRegisterView } from "@/features/auth/UnifiedRegisterView";

function AuthSearchParamsFallback() {
  return (
    <main className="min-h-dvh bg-[#f5f2f8] px-4 py-10">
      <LoadingState label="Loading…" variant="page" />
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthSearchParamsFallback />}>
      <UnifiedRegisterView />
    </Suspense>
  );
}
