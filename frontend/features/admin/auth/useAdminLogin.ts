"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMe } from "@/lib/auth-api";
import { LOGIN_CREDENTIALS_MISMATCH, wrongAdminPortalMessage } from "@/lib/auth-messages";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { loginSchema, parseForm } from "@/lib/validation";

export function useAdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    setFieldErrors({});
    const parsed = parseForm(loginSchema, { email: email.trim(), password });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
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

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return {
    email,
    setEmail: (value: string) => {
      setEmail(value);
      clearFieldError("email");
    },
    password,
    setPassword: (value: string) => {
      setPassword(value);
      clearFieldError("password");
    },
    error,
    fieldErrors,
    submitting,
    onSubmit,
    showLoadingShell,
    hideFormForRedirect,
  };
}
