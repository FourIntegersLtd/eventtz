"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField } from "@/components/ui/PasswordField";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { getMe, resetPassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { parseForm, resetPasswordSchema } from "@/lib/validation";

export function ResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthPageShell logoHref="/">
        <Card padding="lg" className="w-full max-w-md">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">
            Reset password
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            This reset link is missing or incomplete. Request a new one from the forgot
            password page.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            Forgot password
          </Link>
        </Card>
      </AuthPageShell>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = parseForm(resetPasswordSchema, { password, confirmPassword });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, parsed.data.password);
      await refreshUser();
      const me = await getMe();
      router.replace(dashboardPathForUserType(me.user_type));
    } catch (err: unknown) {
      setError(
        getApiErrorDetail(err) ??
          "Could not reset your password. Request a new link and try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell logoHref="/">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter a new password for your Eventtz account.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <PasswordField
            label="New password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordField
            label="Confirm password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </AuthPageShell>
  );
}
