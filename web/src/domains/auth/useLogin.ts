"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { login, logout } from "@/domains/auth/api";
import { isAdminLoginIntent, resolvePostAuthPath } from "@/domains/auth/authRouting";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";
import { useSession } from "@/foundation/session";

/** Form state and submit handling for the sign-in page. Ported from the baseline's `useUnifiedLogin`. */
export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      const nextPath = searchParams.get("next");
      if (isAdminLoginIntent(nextPath) && signedInUser.user_type !== "admin") {
        await logout();
        setError("That account cannot sign in to the admin console.");
        return;
      }
      await refresh();
      router.push(resolvePostAuthPath(nextPath, signedInUser.user_type as "client" | "vendor" | "admin"));
    } catch (cause: unknown) {
      const detail = authErrorDetail(cause) ?? GENERIC_AUTH_ERROR;
      setError(detail);
      if (/verify your email/i.test(detail)) setNeedsVerification(true);
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
    needsVerification,
    postAuthQuery: searchParams.toString(),
  };
}
