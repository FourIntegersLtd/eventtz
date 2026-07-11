"use client";

import { ContactSharingSettingsSection } from "@/features/settings/ContactSharingSettingsSection";
import { SettingsAccountSection } from "@/features/settings/SettingsAccountSection";
import { SettingsLegalSection } from "@/features/settings/SettingsLegalSection";
import { SettingsNotificationsSection } from "@/features/settings/SettingsNotificationsSection";
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
        <p className="text-sm text-neutral-600">
          {role === "vendor"
            ? "Manage privacy and account preferences. Your business listing, pricing, and portfolio are under Profile."
            : "Manage privacy and account preferences for your client account."}
        </p>
      </header>

      <SettingsAccountSection role={role} />
      <ContactSharingSettingsSection role={role} />
      <SettingsNotificationsSection role={role} />
      <SettingsShortcutsSection role={role} />
      <SettingsLegalSection />
      <SettingsSignOutSection />
    </div>
  );
}
