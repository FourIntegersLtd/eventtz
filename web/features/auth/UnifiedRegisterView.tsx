"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Checkbox } from "@/components/ui/Checkbox";
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

/** Options for the client or vendor choice at the top of the register form. */
const ACCOUNT_TYPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
] as const;

/** Register screen: account type, credentials and terms, with the route steps on the brand panel. */
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
    } catch (resendError: unknown) {
      setResendNote(getApiErrorDetail(resendError) ?? GENERIC_AUTH_ERROR);
    } finally {
      setResendBusy(false);
    }
  };

  const title = referralLocked ? "Create your vendor account" : "Create your account";
  const loginHref = postAuthQuery ? `/login?${postAuthQuery}` : "/login";

  return (
    <AuthPageShell
      logoHref={isAuthenticated ? dashboardPathForUserType(userType) : "/"}
      {...(awaitingVerification
        ? {}
        : {
            headline:
              accountType === "client"
                ? "Book a vendor without a single DM."
                : "Get booked without chasing a single DM.",
            panelContent: <RegisterRoute accountType={accountType} />,
          })}
    >
      {awaitingVerification ? (
        <>
          <div>
            <h1 className="font-heading text-3xl font-semibold text-ink">Check your email</h1>
            <p className="mt-2 text-sm text-ink-2">
              Account created. Open the link we sent to{" "}
              <span className="font-medium text-ink">{email}</span>, then sign in.
            </p>
          </div>
          {referralLocked && referralSlug ? (
            <ReferralRegisterBanner displayName={referralDisplayName} slug={referralSlug} />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={resendBusy}
            className="w-full"
            onClick={() => void onResend()}
          >
            Resend verification email
          </Button>
          {resendNote ? <Banner tone="warning">{resendNote}</Banner> : null}
          <p className="text-sm text-ink-2">
            Ready to continue?{" "}
            <Link href={loginHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <>
          {referralLocked ? null : (
            <div className="flex flex-col gap-1.5">
              <span id="account-type-label" className="text-sm font-medium text-ink">
                I am a
              </span>
              <SegmentedControl
                aria-label="I am a"
                semantics="radio"
                stretch
                value={accountType}
                onChange={setAccountType}
                options={ACCOUNT_TYPE_OPTIONS}
              />
            </div>
          )}
          <div>
            <h1 className="font-heading text-3xl font-semibold text-ink">{title}</h1>
            {!referralLocked ? (
              <p className="mt-1 text-sm text-ink-2">
                Planning an event? Choose Client. Selling services? Choose Vendor.
              </p>
            ) : null}
          </div>
          {referralLocked && referralSlug ? (
            <ReferralRegisterBanner displayName={referralDisplayName} slug={referralSlug} />
          ) : null}
          <RegisterRouteCompact accountType={accountType} className="lg:hidden" />

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {error ? <Banner tone="danger">{error}</Banner> : null}

            {referralLocked ? (
              <input type="hidden" name="accountType" value="vendor" />
            ) : null}

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
              autoComplete="new-password"
              value={password}
              error={fieldErrors.password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <div>
              <Checkbox required checked={termsAgreed} onChange={setTermsAgreed}>
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
              </Checkbox>
              {fieldErrors.terms ? (
                <p className="mt-1 text-sm text-danger">{fieldErrors.terms}</p>
              ) : null}
            </div>

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-ink-2">
            Already have an account?{" "}
            <Link href={loginHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthPageShell>
  );
}
