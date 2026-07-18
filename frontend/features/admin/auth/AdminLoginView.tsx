"use client";

import Link from "next/link";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { adminPageBg, adminCard } from "@/features/admin/adminTheme";
import { AdminLoginIllustration } from "@/features/admin/auth/AdminLoginIllustration";
import { useAdminLogin } from "@/features/admin/auth/useAdminLogin";

export function AdminLoginView() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    fieldErrors,
    submitting,
    onSubmit,
    showLoadingShell,
    hideFormForRedirect,
  } = useAdminLogin();

  if (showLoadingShell) {
    return (
      <main className={`flex min-h-screen items-center justify-center ${adminPageBg} px-4 py-10`}>
        <LoadingState label="Loading…" variant="centered" />
      </main>
    );
  }

  if (hideFormForRedirect) {
    return null;
  }

  return (
    <main className={`min-h-dvh ${adminPageBg}`}>
      <div className="grid min-h-dvh lg:grid-cols-2">
        <section className="relative hidden overflow-hidden border-r border-primary-border bg-gradient-to-br from-primary-soft via-white to-primary-muted lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-gold/15 blur-3xl"
            aria-hidden
          />

          <div className="relative z-10 p-10">
            <EventtzLogo priority href="/" />
          </div>

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 pb-8">
            <AdminLoginIllustration className="h-auto w-full max-w-md" />
            <h1 className="mt-8 font-heading text-2xl font-semibold tracking-tight text-neutral-900">
              Eventtz Admin
            </h1>
          </div>

          <p className="relative z-10 px-10 pb-8 text-xs text-neutral-400">© Eventtz</p>
        </section>

        <section className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <div className="flex justify-center lg:hidden">
              <EventtzLogo priority href="/" />
            </div>
            <h2 className="mt-6 text-center font-heading text-2xl font-semibold text-neutral-900 lg:mt-0 lg:text-left">
              Sign in
            </h2>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className={`mt-8 space-y-4 ${adminCard} p-6 sm:p-8`}
            >
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {error}
                </div>
              ) : null}
              <TextField
                id="admin-email"
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                error={fieldErrors.email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <PasswordField
                id="admin-password"
                label="Password"
                autoComplete="current-password"
                value={password}
                error={fieldErrors.password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="-mt-1 text-right text-sm">
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </p>
              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-600 lg:text-left">
              <BackLink href="/" label="Back to site" />
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
