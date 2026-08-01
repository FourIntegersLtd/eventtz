"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { adminPageBg, adminCard } from "@/features/admin/adminTheme";
import { forgotPassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { forgotPasswordSchema, parseForm } from "@/lib/validation";

type ForgotPasswordViewProps = {
  variant?: "default" | "admin";
};

export function ForgotPasswordView({ variant = "default" }: ForgotPasswordViewProps) {
  const searchParams = useSearchParams();
  const isAdmin =
    variant === "admin" || (searchParams.get("portal") ?? "").trim().toLowerCase() === "admin";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const signInHref = isAdmin ? "/admin/login" : "/login";
  const shellClassName = isAdmin ? adminPageBg : undefined;

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

  const cardClassName = isAdmin ? `${adminCard} w-full max-w-md` : "w-full max-w-md";

  return (
    <AuthPageShell logoHref={isAdmin ? "/admin/login" : "/"} className={shellClassName} backHref={signInHref} backLabel="Back to sign in">
      <Card padding="lg" className={cardClassName}>
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">
          {isAdmin ? "Forgot admin password" : "Forgot password"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we&apos;ll send a one-click link to reset your password.
        </p>

        {sentMessage ? (
          <div className="mt-6 space-y-4">
            <LottieIllustration asset="successCheck" className="h-24 w-24" />
            <p className="rounded-xl bg-primary-soft px-3 py-3 text-sm text-neutral-800 ring-1 ring-primary/15">
              {sentMessage}
            </p>
            <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
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
              <Link href={signInHref} className="font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </AuthPageShell>
  );
}
