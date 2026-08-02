"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { TextField } from "@/components/ui/TextField";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { getApiErrorDetail } from "@/lib/api-errors";
import { resendVerification, verifyEmail } from "@/lib/auth-api";

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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await verifyEmail(token);
        if (cancelled) return;
        setMessage(res.message);
        setStatus("success");
        if (res.session) {
          await refreshUser();
          const meType =
            res.user?.user_type === "vendor"
              ? "vendor"
              : res.user?.user_type === "admin"
                ? "admin"
                : "client";
          router.replace(dashboardPathForUserType(meType));
          return;
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus("error");
        setMessage(getApiErrorDetail(e) ?? "This verification link is invalid or has expired.");
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
      setResendNote(getApiErrorDetail(e) ?? "Could not send a new link. Try again later.");
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
              <LottieIllustration asset="successCheck" className="mx-auto mb-3 h-20 w-20" />
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                Email verified
              </h1>
              <p className="mt-3 text-sm text-neutral-600">
                {message ?? "You can sign in with your email and password."}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex text-sm font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-semibold text-neutral-900">
                {status === "missing" ? "Verify your email" : "Link expired"}
              </h1>
              <p className="mt-3 text-sm text-neutral-600">
                {status === "missing"
                  ? "Open the link from your Eventtz email to verify your address. If it expired, request a new one below."
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
