"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMe } from "@/lib/auth-api";
import { LOGIN_CREDENTIALS_MISMATCH, wrongAdminPortalMessage } from "@/lib/auth-messages";
import { dashboardPathForUserType } from "@/features/auth/authRouting";

export function useAdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") || "/admin/dashboard";

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (user.user_type === "admin") {
      router.replace(next.startsWith("/admin") ? next : "/admin/dashboard");
    } else {
      router.replace(dashboardPathForUserType(user.user_type));
    }
  }, [loading, isAuthenticated, user, router, next]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      const u = await getMe();
      if (u.user_type !== "admin") {
        await signOut();
        setError(wrongAdminPortalMessage(u.user_type));
        return;
      }
      router.replace(next.startsWith("/admin") ? next : "/admin/dashboard");
    } catch {
      setError(LOGIN_CREDENTIALS_MISMATCH);
    } finally {
      setSubmitting(false);
    }
  };

  const showLoadingShell = loading;
  const hideFormForRedirect =
    (isAuthenticated && user?.user_type === "admin") ||
    (isAuthenticated && user != null && user.user_type !== "admin");

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    submitting,
    onSubmit,
    showLoadingShell,
    hideFormForRedirect,
  };
}
