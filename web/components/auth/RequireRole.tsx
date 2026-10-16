"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingState } from "@/components/ui/LoadingState";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import type { UserType } from "@/lib/domain-types";

type RequireRoleProps = {
  children: React.ReactNode;
  roles: UserType[];
  /** Where to send signed-in users whose role doesn't match. Defaults to their own dashboard. */
  redirectTo?: string;
  loadingLabel?: string;
};

export function RequireRole({
  children,
  roles,
  redirectTo,
  loadingLabel = "Checking access…",
}: RequireRoleProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    if (!user.user_type || !roles.includes(user.user_type)) {
      router.replace(redirectTo ?? dashboardPathForUserType(user.user_type));
    }
  }, [loading, user, roles, redirectTo, router]);

  if (loading || !user || !user.user_type || !roles.includes(user.user_type)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LoadingState label={loadingLabel} variant="centered" />
      </div>
    );
  }

  return <>{children}</>;
}
