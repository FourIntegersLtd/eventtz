"use client";

import Link from "next/link";
import { useState } from "react";
import { resendVerification } from "@/domains/auth/api";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";
import { AuthPageShell } from "@/foundation/ui/AuthPageShell";
import { useLogin } from "@/domains/auth/useLogin";
import { Button, Card, TextField } from "@/foundation/ui";

/** The sign-in page's content. Ported (simplified) from the baseline's `UnifiedLoginView`. */
export function LoginView() {
  const { email, setEmail, password, setPassword, error, submitting, onSubmit, needsVerification, postAuthQuery } =
    useLogin();
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
      setResendNote(await resendVerification(email.trim()));
    } catch (cause: unknown) {
      setResendNote(authErrorDetail(cause) ?? GENERIC_AUTH_ERROR);
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthPageShell logoHref="/">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in to your account.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="-mt-2 text-right text-sm">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </p>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
          ) : null}

          {needsVerification ? (
            <div className="space-y-2">
              <Button type="button" variant="secondary" loading={resendBusy} className="w-full" onClick={() => void onResend()}>
                Resend verification email
              </Button>
              {resendNote ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200/60">{resendNote}</p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-neutral-600">
          New to Eventtz?{" "}
          <Link href={postAuthQuery ? `/register?${postAuthQuery}` : "/register"} className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </p>
      </Card>
    </AuthPageShell>
  );
}
