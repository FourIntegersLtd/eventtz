"use client";

import Link from "next/link";
import { AuthShell } from "@/domains/auth/AuthShell";
import { useVerifyEmail } from "@/domains/auth/useVerifyEmail";
import { Card, Spinner } from "@/foundation/ui";

/** The email-verification landing page's content. Verifies the token on mount. Ported (simplified) from the baseline's `VerifyEmailView`. */
export function VerifyEmailView() {
  const { status, message } = useVerifyEmail();

  return (
    <AuthShell>
      <Card className="w-full max-w-md text-center">
        {status === "verifying" ? (
          <div className="flex justify-center">
            <Spinner label="Verifying your email…" />
          </div>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-semibold text-neutral-900">
              {status === "success" ? "Email verified" : "Verification failed"}
            </h1>
            <p
              className={
                status === "success"
                  ? "mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/60"
                  : "mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60"
              }
            >
              {message}
            </p>
            <p className="mt-5 text-sm text-neutral-600">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Continue to sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </AuthShell>
  );
}
