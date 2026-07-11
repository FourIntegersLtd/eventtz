"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

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
      <main className="min-h-screen bg-[var(--page-bg)] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-600">Just a moment — checking you&apos;re signed in…</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
