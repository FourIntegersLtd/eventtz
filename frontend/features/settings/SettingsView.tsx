"use client";

import { ContactSharingSettingsSection } from "@/features/settings/ContactSharingSettingsSection";
import { SettingsAccountSection } from "@/features/settings/SettingsAccountSection";
import { SettingsClientOnboardingSection } from "@/features/settings/SettingsClientOnboardingSection";
import { SettingsLegalSection } from "@/features/settings/SettingsLegalSection";
import { SettingsNotificationsSection } from "@/features/settings/SettingsNotificationsSection";
import { SettingsOnboardingPreviewSection } from "@/features/settings/SettingsOnboardingPreviewSection";
import { SettingsShortcutsSection } from "@/features/settings/SettingsShortcutsSection";
import { SettingsSignOutSection } from "@/features/settings/SettingsSignOutSection";
import type { PortalRole } from "@/components/portal-shell/portalNav";

export type SettingsViewProps = {
  role: PortalRole;
};

/**
 * Account preferences — separate from vendor Profile (public listing) and from
 * operational pages (bookings, payments, disputes).
 */
export function SettingsView({ role }: SettingsViewProps) {
  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Account, privacy, and shortcuts.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <SettingsAccountSection role={role} />
          <ContactSharingSettingsSection role={role} />
          <SettingsNotificationsSection role={role} />
          {role === "client" ? <SettingsClientOnboardingSection /> : null}
          {role === "vendor" ? <SettingsOnboardingPreviewSection /> : null}
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-4">
          <SettingsShortcutsSection role={role} />
          <SettingsLegalSection />
          <SettingsSignOutSection />
        </aside>
      </div>
    </div>
  );
}
