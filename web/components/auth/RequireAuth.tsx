"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";

type RequireAuthProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

export function RequireAuth({
  children,
  redirectTo = "/login",
}: RequireAuthProps) {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  if (loading || !isAuthenticated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--page-bg)] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6">
          <LoadingState
            label="Just a moment - checking you're signed in…"
            variant="centered"
            className="py-4"
          />
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
