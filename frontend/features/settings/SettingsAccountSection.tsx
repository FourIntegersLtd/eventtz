"use client";

import Link from "next/link";
import { Mail, UserCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";

type Props = {
  role: PortalRole;
};

export function SettingsAccountSection({ role }: Props) {
  const { user } = useAuth();

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Account</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {role === "vendor"
          ? "Sign-in email for your Eventtz account. Business name, phone, and listing details are in Profile."
          : "Sign-in email for your Eventtz account."}
      </p>

      <dl className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-neutral-500">Email</dt>
            <dd className="truncate text-sm font-medium text-neutral-900">{user?.email ?? "—"}</dd>
          </div>
        </div>
      </dl>

      {role === "vendor" ? (
        <Link
          href={portalRoute("vendor", "profile")}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <UserCircle2 className="h-4 w-4" aria-hidden />
          Edit vendor profile
        </Link>
      ) : null}
    </section>
  );
}
