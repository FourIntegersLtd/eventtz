"use client";

import Link from "next/link";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { dashboardPathForUserType } from "@/features/auth/authRouting";
import { useUnifiedRegister } from "@/features/auth/useUnifiedRegister";

export function UnifiedRegisterView() {
  const {
    accountType,
    setAccountType,
    email,
    setEmail,
    password,
    setPassword,
    error,
    message,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType,
  } = useUnifiedRegister();

  return (
    <AuthPageShell logoHref={isAuthenticated ? dashboardPathForUserType(userType) : "/"}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/50 sm:p-8">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-500">Tell us a bit about you to get started.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Select
            label="I am a…"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value === "vendor" ? "vendor" : "client")}
          >
            <option value="client">Client — planning an event</option>
            <option value="vendor">Vendor — offering services</option>
          </Select>

          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200/60">
              {message}
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
      </div>
    </AuthPageShell>
  );
}
