"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { forgotPassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { forgotPasswordSchema, parseForm } from "@/lib/validation";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = parseForm(forgotPasswordSchema, { email: email.trim() });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await forgotPassword(parsed.data.email);
      track(MixpanelEvents.password_reset_requested);
      setSentMessage(res.message);
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not send a reset email. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell logoHref="/">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">
          Forgot password
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we&apos;ll send a one-click link to reset your password.
        </p>

        {sentMessage ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-primary-soft px-3 py-3 text-sm text-neutral-800 ring-1 ring-primary/15">
              {sentMessage}
            </p>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <TextField
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              error={fieldErrors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
            />
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-sm text-neutral-600">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </AuthPageShell>
  );
}
