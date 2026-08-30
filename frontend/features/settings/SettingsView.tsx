"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ContactSharingSettingsSection } from "@/features/settings/ContactSharingSettingsSection";
import { SettingsAccountSection } from "@/features/settings/SettingsAccountSection";
import { SettingsClientOnboardingSection } from "@/features/settings/SettingsClientOnboardingSection";
import { SettingsDeleteAccountSection } from "@/features/settings/SettingsDeleteAccountSection";
import { SettingsLegalSection } from "@/features/settings/SettingsLegalSection";
import { SettingsNotificationsSection } from "@/features/settings/SettingsNotificationsSection";
import { SettingsReferralsSection } from "@/features/settings/SettingsReferralsSection";
import { SettingsShortcutsSection } from "@/features/settings/SettingsShortcutsSection";
import { SettingsSignOutSection } from "@/features/settings/SettingsSignOutSection";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import { LoadingState } from "@/components/ui/LoadingState";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";

export type SettingsViewProps = {
  role: PortalRole;
};

const ALL_TABS = [
  { id: "account", label: "Account" },
  { id: "privacy", label: "Privacy" },
  { id: "referrals", label: "Referrals" },
  { id: "more", label: "More" },
] as const;

type SettingsTabId = (typeof ALL_TABS)[number]["id"];

const LEGACY_TAB_IDS: Record<string, SettingsTabId> = {
  contact: "privacy",
  notifications: "privacy",
  shortcuts: "more",
};

function tabsForRole(role: PortalRole) {
  if (role === "vendor") return ALL_TABS;
  return ALL_TABS.filter((tab) => tab.id !== "referrals");
}

function resolveSettingsTabId(value: string | null, role: PortalRole): SettingsTabId {
  const allowed = tabsForRole(role);
  if (value && allowed.some((tab) => tab.id === value)) {
    return value as SettingsTabId;
  }
  if (value && value in LEGACY_TAB_IDS) {
    return LEGACY_TAB_IDS[value];
  }
  return "account";
}

function SettingsTabPanel({ role, tab }: { role: PortalRole; tab: SettingsTabId }) {
  switch (tab) {
    case "account":
      return (
        <div className="space-y-8">
          <SettingsAccountSection role={role} />
          {role === "client" ? <SettingsClientOnboardingSection /> : null}
          <SettingsDeleteAccountSection />
          <SettingsSignOutSection />
        </div>
      );
    case "privacy":
      return (
        <div className="space-y-8">
          <ContactSharingSettingsSection role={role} />
          <SettingsNotificationsSection role={role} />
        </div>
      );
    case "referrals":
      if (role !== "vendor") return null;
      return (
        <div className="space-y-8">
          <SettingsReferralsSection />
        </div>
      );
    case "more":
      return (
        <div className="space-y-8">
          <SettingsShortcutsSection role={role} />
          <SettingsLegalSection />
        </div>
      );
  }
}

function SettingsViewContent({ role }: SettingsViewProps) {
  const searchParams = useSearchParams();
  const tabs = useMemo(() => tabsForRole(role), [role]);
  const tab = useMemo(
    (): SettingsTabId => resolveSettingsTabId(searchParams.get("tab"), role),
    [searchParams, role],
  );

  const basePath = portalRoute(role, "settings");

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      <SettingsTabs tabs={tabs} activeId={tab} basePath={basePath} />

      <div role="tabpanel" aria-label={tabs.find((item) => item.id === tab)?.label}>
        <SettingsTabPanel role={role} tab={tab} />
      </div>
    </div>
  );
}

/**
 * Account preferences - separate from vendor Profile (public listing) and from
 * operational pages (bookings, payments, disputes).
 */
export function SettingsView({ role }: SettingsViewProps) {
  return (
    <Suspense fallback={<LoadingState label="Loading settings…" />}>
      <SettingsViewContent role={role} />
    </Suspense>
  );
}
