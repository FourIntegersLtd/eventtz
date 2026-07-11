"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getMe } from "@/lib/auth-api";
import { LOGIN_CREDENTIALS_MISMATCH, SESSION_VERIFY_FAILED } from "@/lib/auth-messages";
import { resolvePostAuthPath } from "@/features/auth/authRouting";

export function useUnifiedLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postAuthQuery = useMemo(() => searchParams.toString(), [searchParams]);
  const { signIn, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError(LOGIN_CREDENTIALS_MISMATCH);
      setSubmitting(false);
      return;
    }
    try {
      const me = await getMe();
      router.push(resolvePostAuthPath(searchParams.get("next"), me.user_type));
    } catch {
      setError(SESSION_VERIFY_FAILED);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    error,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType: user?.user_type,
  };
}
