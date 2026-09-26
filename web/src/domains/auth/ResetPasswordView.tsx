"use client";

import Link from "next/link";
import { AuthShell } from "@/domains/auth/AuthShell";
import { useResetPassword } from "@/domains/auth/useResetPassword";
import { Button, Card, TextField } from "@/foundation/ui";

/** The "reset password" page's content, reached via the emailed link's `?token=`. Ported (simplified) from the baseline's `ResetPasswordView`. */
export function ResetPasswordView() {
  const { token, password, setPassword, error, submitting, onSubmit } = useResetPassword();

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Choose a new password</h1>

        {!token ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
            This reset link is missing its token.{" "}
            <Link href="/forgot-password" className="font-medium underline">
              Request a new one
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <TextField
              label="New password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
            ) : null}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </Card>
    </AuthShell>
  );
}
