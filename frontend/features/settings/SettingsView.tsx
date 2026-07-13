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
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-neutral-600">Account and privacy.</p>
      </header>

      <SettingsAccountSection role={role} />
      <ContactSharingSettingsSection role={role} />
      <SettingsNotificationsSection role={role} />
      {role === "client" ? <SettingsClientOnboardingSection /> : null}
      {role === "vendor" ? <SettingsOnboardingPreviewSection /> : null}
      <SettingsShortcutsSection role={role} />
      <SettingsLegalSection />
      <SettingsSignOutSection />
    </div>
  );
}
