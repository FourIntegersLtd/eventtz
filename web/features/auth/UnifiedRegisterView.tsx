"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { ReferralRegisterBanner } from "@/features/auth/ReferralRegisterBanner";
import {
  RegisterRoute,
  RegisterRouteCompact,
} from "@/features/auth/RegisterRoute";
import { useUnifiedRegister } from "@/features/auth/useUnifiedRegister";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { resendVerification } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";

export function UnifiedRegisterView() {
  const {
    accountType,
    setAccountType,
    email,
    setEmail,
    password,
    termsAgreed,
    setTermsAgreed,
    setPassword,
    error,
    fieldErrors,
    message,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType,
    referralDisplayName,
    referralLocked,
    referralSlug,
  } = useUnifiedRegister();

  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const awaitingVerification = Boolean(message);

  const onResend = async () => {
    setResendNote(null);
    if (!email.trim()) {
      setResendNote("Enter the email you registered with.");
      return;
    }
    setResendBusy(true);
    try {
      const res = await resendVerification(email.trim());
      setResendNote(res.message);
    } catch (e: unknown) {
      setResendNote(getApiErrorDetail(e) ?? GENERIC_AUTH_ERROR);
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthPageShell
      logoHref={isAuthenticated ? dashboardPathForUserType(userType) : "/"}
    >
      <div className="flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <Card padding="lg" className="w-full max-w-md shrink-0">
          {awaitingVerification ? (
            <>
              {referralLocked && referralSlug ? (
                <ReferralRegisterBanner
                  displayName={referralDisplayName}
                  slug={referralSlug}
                  className="mb-5"
                />
              ) : null}
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                Check your email
              </h1>
              <p className="mt-3 text-sm text-neutral-600">
                Account created. Open the link we sent to{" "}
                <span className="font-medium text-neutral-800">{email}</span>,
                then sign in.
              </p>
              <Button
                type="button"
                variant="secondary"
                loading={resendBusy}
                className="mt-6 w-full"
                onClick={() => void onResend()}
              >
                Resend verification email
              </Button>
              {resendNote ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200/60">
                  {resendNote}
                </p>
              ) : null}
              <p className="mt-5 text-sm text-neutral-600">
                Ready to continue?{" "}
                <Link
                  href={postAuthQuery ? `/login?${postAuthQuery}` : "/login"}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                {referralLocked
                  ? "Create your vendor account"
                  : "Create your account"}
              </h1>
              {!referralLocked ? (
                <p className="mt-1 text-sm text-neutral-500">
                  Choose an account type to get started.
                </p>
              ) : null}
              <RegisterRouteCompact
                accountType={accountType}
                className="mt-5 lg:hidden"
              />

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {referralLocked && referralSlug ? (
                  <ReferralRegisterBanner
                    displayName={referralDisplayName}
                    slug={referralSlug}
                  />
                ) : null}

                {referralLocked ? (
                  <input type="hidden" name="accountType" value="vendor" />
                ) : (
                  <Select
                    label="I am a…"
                    value={accountType}
                    onChange={(e) =>
                      setAccountType(
                        e.target.value === "client" ? "client" : "vendor",
                      )
                    }
                  >
                    <option value="vendor">Vendor</option>
                    <option value="client">Client</option>
                  </Select>
                )}

                <TextField
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  error={fieldErrors.email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <PasswordField
                  label="Password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  error={fieldErrors.password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div>
                  <label className="flex items-start gap-3 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      required
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-neutral-300 text-primary"
                    />
                    <span>
                      I agree to the{" "}
                      <Link
                        href="/compliances/terms-of-service"
                        target="_blank"
                        className="font-medium text-primary hover:underline"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/compliances/privacy-policy"
                        target="_blank"
                        className="font-medium text-primary hover:underline"
                      >
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                  {fieldErrors.terms ? (
                    <p className="mt-1 text-sm text-red-700">
                      {fieldErrors.terms}
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" loading={submitting} className="w-full">
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="mt-5 text-sm text-neutral-600">
                Already have an account?{" "}
                <Link
                  href={postAuthQuery ? `/login?${postAuthQuery}` : "/login"}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </Card>
        {awaitingVerification ? null : (
          <RegisterRoute
            accountType={accountType}
            className="hidden lg:block"
          />
        )}
      </div>
    </AuthPageShell>
  );
}
