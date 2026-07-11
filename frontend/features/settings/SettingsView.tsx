"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ParticipantDisputesListView } from "@/features/bookings/ParticipantDisputesListView";
import { ContactSharingSettingsSection } from "@/features/settings/ContactSharingSettingsSection";

export type SettingsViewProps = {
  role: "vendor" | "client";
};

/**
 * Shared account-settings shell for both portals — read-only account info plus
 * the disputes list, which used to live as an extra tab on the Bookings page.
 * Disputes moved here so Bookings only ever shows bookings.
 */
export function SettingsView({ role }: SettingsViewProps) {
  const { user } = useAuth();
  const roleLabel = role === "vendor" ? "Vendor" : "Client";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Account</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-neutral-500">Email</dt>
              <dd className="truncate text-sm font-medium text-neutral-900">
                {user?.email ?? "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-neutral-500">Account type</dt>
              <dd className="truncate text-sm font-medium text-neutral-900">{roleLabel}</dd>
            </div>
          </div>
        </dl>
      </section>

      <ContactSharingSettingsSection />

      <section>
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Disputes</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Disputes raised on your bookings, and any you&apos;ve raised yourself.
        </p>
        <div className="mt-4">
          <ParticipantDisputesListView role={role} />
        </div>
      </section>
    </div>
  );
}
