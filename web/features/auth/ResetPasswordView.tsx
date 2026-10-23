"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Banner";
import { PasswordField } from "@/components/ui/PasswordField";
import { dashboardPathForUserType, loginPathWithNext } from "@/features/auth/authRouting";
import { getMe, resetPassword } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import {
  ADMIN_PASSWORD_REQUIREMENTS,
  adminResetPasswordSchema,
  parseForm,
  resetPasswordSchema,
} from "@/lib/validation";

type ResetPasswordViewProps = {
  variant?: "default" | "admin";
};

/** Choose-a-new-password screen reached from the emailed reset link. */
export function ResetPasswordView({ variant = "default" }: ResetPasswordViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);
  const isAdmin =
    variant === "admin" || (searchParams.get("portal") ?? "").trim().toLowerCase() === "admin";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const forgotHref = isAdmin ? "/forgot-password?portal=admin" : "/forgot-password";
  const adminSignInHref = loginPathWithNext("/admin/dashboard");
  const shellClassName = isAdmin ? "bg-neutral-50" : undefined;
  const schema = isAdmin ? adminResetPasswordSchema : resetPasswordSchema;
  const minLength = 6;

  if (!token) {
    return (
      <AuthPageShell
        logoHref={isAdmin ? adminSignInHref : "/"}
        className={shellClassName}
        backHref={isAdmin ? adminSignInHref : "/"}
        backLabel={isAdmin ? "Back to sign in" : "Back to home"}
        headline="A fresh start."
        supportingLine="Choose a strong password you do not use anywhere else."
      >
        <div>
          <h1 className="font-heading text-3xl font-semibold text-ink">Reset password</h1>
          <p className="mt-3 text-sm text-ink-2">
            This reset link is missing or incomplete. Request a new one from the forgot
            password page.
          </p>
        </div>
        <Link href={forgotHref} className="text-sm font-medium text-primary hover:underline">
          Forgot password
        </Link>
      </AuthPageShell>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = parseForm(schema, { password, confirmPassword });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, parsed.data.password);
      track(MixpanelEvents.password_reset_completed);
      showToast({ title: "Password updated", tone: "success" });
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
    <AuthPageShell
      logoHref={isAdmin ? adminSignInHref : "/"}
      className={shellClassName}
      backHref={isAdmin ? adminSignInHref : "/"}
      backLabel={isAdmin ? "Back to sign in" : "Back to home"}
      headline="A fresh start."
      supportingLine="Choose a strong password you do not use anywhere else."
    >
      <div>
        <h1 className="font-heading text-3xl font-semibold text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-ink-2">
          {isAdmin
            ? "Enter a strong password for your admin account."
            : "Enter a new password for your Eventtz account."}
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <PasswordField
          label="New password"
          required
          minLength={minLength}
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm password"
          required
          minLength={minLength}
          autoComplete="new-password"
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {submitting ? "Saving…" : "Update password"}
        </Button>
      </form>
      {isAdmin ? (
        <Banner tone="danger" title="Password requirements">
          <ul className="list-outside list-disc space-y-1.5 pl-5">
            {ADMIN_PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement} className="pl-1">
                {requirement}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}
    </AuthPageShell>
  );
}
