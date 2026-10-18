"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { useUnifiedLogin } from "@/features/auth/useUnifiedLogin";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { resendVerification } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";

/** Sign-in screen: email and password form on the split auth shell. */
export function UnifiedLoginView() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    fieldErrors,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType,
    needsVerification,
  } = useUnifiedLogin();

  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  const onResend = async () => {
    setResendNote(null);
    if (!email.trim()) {
      setResendNote("Enter your email above, then request a new link.");
      return;
    }
    setResendBusy(true);
    try {
      const res = await resendVerification(email.trim());
      setResendNote(res.message);
    } catch (resendError: unknown) {
      setResendNote(getApiErrorDetail(resendError) ?? GENERIC_AUTH_ERROR);
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthPageShell logoHref={isAuthenticated ? dashboardPathForUserType(userType) : "/"}>
      <div>
        <h1 className="font-heading text-3xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in to your account.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {error ? <Banner tone="danger">{error}</Banner> : null}

        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label="Password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="-mt-3 text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </p>

        {needsVerification ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              loading={resendBusy}
              className="w-full"
              onClick={() => void onResend()}
            >
              Resend verification email
            </Button>
            {resendNote ? <Banner tone="warning">{resendNote}</Banner> : null}
          </div>
        ) : null}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-ink-2">
        New to Eventtz?{" "}
        <Link
          href={postAuthQuery ? `/register?${postAuthQuery}` : "/register"}
          className="font-medium text-primary hover:underline"
        >
          Create account
        </Link>
      </p>
    </AuthPageShell>
  );
}
