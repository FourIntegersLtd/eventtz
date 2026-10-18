"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Banner } from "@/components/ui/Banner";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { TextField } from "@/components/ui/TextField";
import type { UserType } from "@/lib/domain-types";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { getApiErrorCode, getApiErrorDetail } from "@/lib/api-errors";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { resendVerification, verifyEmail } from "@/lib/auth-api";

/** Short heading for a failed verification, chosen from the API message. */
function verifyErrorTitle(code: string | null): string {
  // The API gives one code for an unknown, expired or already used link.
  if (code === "verification_link_invalid") return "Invalid or expired link";
  return "Couldn't verify email";
}

/** Landing screen for the emailed verification link: verifying, verified or failed. */
export function VerifyEmailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);

  const [status, setStatus] = useState<"loading" | "success" | "error" | "missing">(
    token ? "loading" : "missing",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const verifyStartedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || verifyStartedRef.current === token) return;
    verifyStartedRef.current = token;
    let cancelled = false;
    void (async () => {
      try {
        const res = await verifyEmail(token);
        if (cancelled) return;
        setMessage(res.message);
        setStatus("success");
        if (res.session) {
          await refreshUser();
          router.replace(
            dashboardPathForUserType(res.user?.user_type as UserType | undefined),
          );
          return;
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus("error");
        setErrorCode(getApiErrorCode(e));
        setMessage(getApiErrorDetail(e) ?? GENERIC_AUTH_ERROR);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshUser, router]);

  const onResend = async () => {
    setResendNote(null);
    const email = resendEmail.trim();
    if (!email) {
      setResendNote("Enter the email you used to register.");
      return;
    }
    setResendBusy(true);
    try {
      const res = await resendVerification(email);
      setResendNote(res.message);
    } catch (e: unknown) {
      setResendNote(getApiErrorDetail(e) ?? GENERIC_AUTH_ERROR);
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthPageShell logoHref="/" backHref="/login" backLabel="Back to sign in">
      {status === "loading" ? (
        <LoadingState label="Verifying your email…" variant="page" branded />
      ) : status === "success" ? (
        <>
          <LottieIllustration asset="successCheck" size="status" />
          <div>
            <h1 className="font-heading text-3xl font-semibold text-ink">Email verified</h1>
            <p className="mt-2 text-sm text-ink-2">
              {message ?? "You're all set. Sign in with your email and password."}
            </p>
          </div>
          <ButtonLink href="/login" size="lg" className="w-full">
            Sign in
          </ButtonLink>
        </>
      ) : (
        <>
          <LottieIllustration
            asset={status === "missing" ? "pendingReview" : "failure"}
            size="status"
          />
          <div>
            <h1 className="font-heading text-3xl font-semibold text-ink">
              {status === "missing" ? "Verify your email" : verifyErrorTitle(errorCode)}
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              {status === "missing"
                ? "Open the link from your Eventtz email. If it expired, request a new one below."
                : (message ?? "Request a new verification link below.")}
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <TextField
              label="Email"
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Button
              type="button"
              size="lg"
              loading={resendBusy}
              onClick={() => void onResend()}
              className="w-full"
            >
              Send new link
            </Button>
            {resendNote ? <Banner tone="warning">{resendNote}</Banner> : null}
          </div>
        </>
      )}
    </AuthPageShell>
  );
}
