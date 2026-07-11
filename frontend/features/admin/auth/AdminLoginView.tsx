"use client";

import Link from "next/link";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { adminPageBg, adminCard } from "@/features/admin/adminTheme";
import { useAdminLogin } from "@/features/admin/auth/useAdminLogin";

export function AdminLoginView() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    submitting,
    onSubmit,
    showLoadingShell,
    hideFormForRedirect,
  } = useAdminLogin();

  if (showLoadingShell) {
    return (
      <main className={`flex min-h-screen items-center justify-center ${adminPageBg} px-4 py-10`}>
        <p className="text-sm text-neutral-600">Loading…</p>
      </main>
    );
  }

  if (hideFormForRedirect) {
    return null;
  }

  return (
    <main className={`min-h-screen ${adminPageBg}`}>
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden flex-col justify-between border-r border-neutral-200/80 bg-white p-10 lg:flex">
          <EventtzLogo priority href="/" />
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900">
              Eventtz Admin
            </h1>
          </div>
          <p className="text-xs text-neutral-400">© Eventtz</p>
        </section>

        <section className="flex flex-col justify-center px-4 py-10 sm:px-8">
          <div className="mx-auto w-full max-w-md">
            <div className="flex justify-center lg:hidden">
              <EventtzLogo priority href="/" />
            </div>
            <h2 className="mt-6 text-center font-heading text-2xl font-semibold text-neutral-900 lg:mt-0 lg:text-left">
              Sign in
            </h2>
            <p className="mt-2 text-center text-sm text-neutral-600 lg:text-left">
              For Eventtz staff only. Vendor or client? Use the homepage sign-in links.
            </p>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className={`mt-8 space-y-4 ${adminCard} p-6`}
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
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                id="admin-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-600 lg:text-left">
              <Link href="/" className="font-medium text-primary hover:underline">
                Back to site
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
