"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMe } from "@/lib/auth-api";
import { LOGIN_CREDENTIALS_MISMATCH, SESSION_VERIFY_FAILED } from "@/lib/auth-messages";
import { resolvePostAuthPath } from "@/features/auth/authRouting";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { loginSchema, parseForm } from "@/lib/validation";

export function useUnifiedLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postAuthQuery = useMemo(() => searchParams.toString(), [searchParams]);
  const { signIn, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    } catch {
      track(MixpanelEvents.login_failed, { reason: "credentials" });
      setError(LOGIN_CREDENTIALS_MISMATCH);
      setSubmitting(false);
      return;
    }
    try {
      const me = await getMe();
      router.push(resolvePostAuthPath(searchParams.get("next"), me.user_type));
    } catch {
      track(MixpanelEvents.login_failed, { reason: "session_verify" });
      setError(SESSION_VERIFY_FAILED);
    } finally {
      setSubmitting(false);
    }
  };

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
    postAuthQuery,
    isAuthenticated,
    userType: user?.user_type,
  };
}
