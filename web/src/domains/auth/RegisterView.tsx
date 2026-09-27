"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { AuthPageShell } from "@/foundation/ui/AuthPageShell";
import { useRegister, type RegisterAccountType } from "@/domains/auth/useRegister";
import { Button, Card, TextField } from "@/foundation/ui";

/** One tab in the account-type toggle. */
function AccountTypeTab({
  value,
  current,
  label,
  onSelect,
}: {
  value: RegisterAccountType;
  current: RegisterAccountType;
  label: string;
  onSelect: (value: RegisterAccountType) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={clsx(
        "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
        active ? "bg-white text-primary shadow-sm" : "text-neutral-500 hover:text-neutral-700",
      )}
    >
      {label}
    </button>
  );
}

/** The registration page's content. Ported (simplified) from the baseline's `UnifiedRegisterView`. */
export function RegisterView() {
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
  } = useRegister();

  return (
    <AuthPageShell logoHref="/">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-500">Join Eventtz as a client or a vendor.</p>

        <div className="mt-5 flex gap-1 rounded-xl bg-primary-soft p-1">
          <AccountTypeTab value="client" current={accountType} label="I'm planning an event" onSelect={setAccountType} />
          <AccountTypeTab value="vendor" current={accountType} label="I'm a vendor" onSelect={setAccountType} />
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/60">
            {message}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <TextField
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
            ) : null}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        )}

        <p className="mt-5 text-sm text-neutral-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </AuthPageShell>
  );
}
