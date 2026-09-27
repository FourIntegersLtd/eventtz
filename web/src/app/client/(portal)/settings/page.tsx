"use client";

import { SettingsView } from "@/domains/settings/SettingsView";
import { SettingsClientOnboardingSection } from "@/domains/client-onboarding/SettingsClientOnboardingSection";

/** `/client/settings` — account and contact-sharing preferences, plus the client-only "rerun tour" control. */
export default function ClientSettingsPage() {
  return <SettingsView role="client" extraSections={<SettingsClientOnboardingSection />} />;
}
