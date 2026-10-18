"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { TextField } from "@/components/ui/TextField";
import { adminPageBg } from "@/components/admin-shell/adminTheme";
import { loginPathWithNext } from "@/features/auth/authRouting";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { forgotPassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { forgotPasswordSchema, parseForm } from "@/lib/validation";

type ForgotPasswordViewProps = {
  variant?: "default" | "admin";
};

/** Request-a-reset-link screen (client/vendor and admin variants). */
export function ForgotPasswordView({ variant = "default" }: ForgotPasswordViewProps) {
  const searchParams = useSearchParams();
  const isAdmin =
    variant === "admin" || (searchParams.get("portal") ?? "").trim().toLowerCase() === "admin";
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const signInHref = isAdmin ? loginPathWithNext("/admin/dashboard") : "/login";
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
      setError(getApiErrorDetail(err) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      logoHref={isAdmin ? signInHref : "/"}
      className={shellClassName}
      backHref={signInHref}
      backLabel="Back to sign in"
      headline="Back in, quickly."
      supportingLine="We will email you a secure link that works for one hour."
    >
      <div>
        <h1 className="font-heading text-3xl font-semibold text-ink">
          {isAdmin ? "Forgot admin password" : "Forgot password"}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Enter the email on your account and we&apos;ll send a link to choose a new password.
        </p>
      </div>

      {sentMessage ? (
        <div className="flex flex-col gap-5">
          <LottieIllustration asset="successCheck" size="status" />
          <Banner tone="success" title="Check your inbox">
            {sentMessage}
          </Banner>
          <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          {error ? <Banner tone="danger">{error}</Banner> : null}
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
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthPageShell>
  );
}
