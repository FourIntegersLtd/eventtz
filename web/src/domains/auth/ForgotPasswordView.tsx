"use client";

import Link from "next/link";
import { AuthShell } from "@/domains/auth/AuthShell";
import { useForgotPassword } from "@/domains/auth/useForgotPassword";
import { Button, Card, TextField } from "@/foundation/ui";

/** The "forgot password" page's content. Ported (simplified) from the baseline's `ForgotPasswordView`. */
export function ForgotPasswordView() {
  const { email, setEmail, error, message, submitting, onSubmit } = useForgotPassword();

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the email on your account and we&apos;ll send you a link to reset your password.
        </p>

        {message ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/60">
            {message}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <TextField
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
            ) : null}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-5 text-sm text-neutral-600">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
