"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { TextField } from "@/components/ui/TextField";
import type { UserType } from "@/lib/domain-types";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { getApiErrorDetail } from "@/lib/api-errors";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { resendVerification, verifyEmail } from "@/lib/auth-api";

function verifyErrorTitle(message: string | null): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("expired")) return "Link expired";
  if (text.includes("invalid")) return "Invalid link";
  return "Couldn't verify email";
}

export function VerifyEmailView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);

  const [status, setStatus] = useState<"loading" | "success" | "error" | "missing">(
    token ? "loading" : "missing",
  );
  const [message, setMessage] = useState<string | null>(null);
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
      ) : (
        <Card padding="lg" className="w-full max-w-md">
          {status === "success" ? (
            <>
              <LottieIllustration asset="successCheck" size="status" className="mb-4" />
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                Email verified
              </h1>
              <p className="mt-3 text-sm text-neutral-600">
                {message ?? "You're all set. Sign in with your email and password."}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              <LottieIllustration
                asset={status === "missing" ? "pendingReview" : "failure"}
                size="status"
                className="mb-4"
              />
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                {status === "missing" ? "Verify your email" : verifyErrorTitle(message)}
              </h1>
              <p className="mt-3 text-sm text-neutral-600">
                {status === "missing"
                  ? "Open the link from your Eventtz email. If it expired, request a new one below."
                  : (message ?? "Request a new verification link below.")}
              </p>
              <div className="mt-6 space-y-3">
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
                  loading={resendBusy}
                  onClick={() => void onResend()}
                  className="w-full"
                >
                  Send new link
                </Button>
                {resendNote ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200/60">
                    {resendNote}
                  </p>
                ) : null}
              </div>
              <Link
                href="/login"
                className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </>
          )}
        </Card>
      )}
    </AuthPageShell>
  );
}
