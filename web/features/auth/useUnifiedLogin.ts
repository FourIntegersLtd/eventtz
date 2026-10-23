"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { wrongAdminPortalMessage } from "@/lib/auth-messages";
import { clearFieldError } from "@/lib/formHelpers";
import { classifyLoginFailure } from "@/features/auth/loginFailure";
import { isAdminLoginIntent, resolvePostAuthPath } from "@/features/auth/authRouting";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { loginSchema, parseForm } from "@/lib/validation";

export function useUnifiedLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postAuthQuery = useMemo(() => searchParams.toString(), [searchParams]);
  const { signIn, signOut, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setNeedsVerification(false);
    const parsed = parseForm(loginSchema, { email: email.trim(), password });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      const signedInUser = await signIn(parsed.data.email, parsed.data.password);
      const nextPath = searchParams.get("next");
      if (isAdminLoginIntent(nextPath) && signedInUser.user_type !== "admin") {
        await signOut();
        setError(wrongAdminPortalMessage(signedInUser.user_type));
        return;
      }
      router.push(resolvePostAuthPath(nextPath, signedInUser.user_type));
    } catch (err: unknown) {
      const failure = classifyLoginFailure(err);
      track(MixpanelEvents.login_failed, { reason: failure.reason });
      setError(failure.message);
      setNeedsVerification(failure.needsVerification);
    } finally {
      setSubmitting(false);
    }
  };

  const onFieldErrorClear = (field: string) => {
    setFieldErrors((prev) => clearFieldError(prev, field));
  };

  return {
    email,
    setEmail: (value: string) => {
      setEmail(value);
      onFieldErrorClear("email");
    },
    password,
    setPassword: (value: string) => {
      setPassword(value);
      onFieldErrorClear("password");
    },
    error,
    fieldErrors,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType: user?.user_type,
    needsVerification,
  };
}
