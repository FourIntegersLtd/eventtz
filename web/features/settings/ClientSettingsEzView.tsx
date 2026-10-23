"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, Route, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";
import {
  CloseAccountCard,
  ContactSharingCard,
  PolicyLinksCard,
  SecurityCard,
  SettingsCard,
  useContactSharing,
} from "@/features/settings/SettingsCards";
import { getClientOnboarding, updateClientOnboarding } from "@/lib/clientOnboardingApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { parseForm, preferredNameFormSchema } from "@/lib/validation";
import { portalRoute } from "@/components/portal-shell/portalNav";

type SettingsTab = "account" | "privacy" | "more";

const CLIENT_SETTINGS_TABS = [
  { value: "account", label: "Account" },
  { value: "privacy", label: "Privacy" },
  { value: "more", label: "More" },
] as const;

function resolveTab(value: string | null): SettingsTab {
  if (value === "privacy" || value === "more") return value;
  return "account";
}

/**
 * Client settings (design C26): same ez card layout as vendor `VendorSettingsEzView`.
 */
export function ClientSettingsEzView() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));
  const { openReplay } = useClientOnboarding();
  const { contact, saving: contactSaving, toggle: toggleContact } = useContactSharing(
    "Privacy preferences saved",
    "Could not save preferences",
  );

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getClientOnboarding()
      .then((state) => {
        if (!cancelled) {
          setName(state.preferred_name?.trim() ?? user?.preferred_name?.trim() ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setName(user?.preferred_name?.trim() ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.preferred_name]);

  const saveAccount = async () => {
    const parsed = parseForm(preferredNameFormSchema, { preferredName: name });
    if (!parsed.ok) {
      showToast({ title: parsed.formError ?? "Enter a valid name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await updateClientOnboarding({ preferredName: parsed.data.preferredName });
      await refreshUser();
      showToast({ title: "Account saved", tone: "success" });
    } catch (err: unknown) {
      showToast({
        title: "Could not save",
        description: getApiErrorDetail(err) ?? "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading settings…" variant="centered" />;
  }

  const settingsBase = portalRoute("client", "settings");

  return (
    <div className="ez-stack ez-stack--lg min-w-0 max-w-3xl">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your sign-in, privacy, and shortcuts."
      />

      <Tabs
        aria-label="Settings sections"
        options={CLIENT_SETTINGS_TABS}
        value={tab}
        onChange={(next) => router.push(next === "account" ? settingsBase : `${settingsBase}?tab=${next}`)}
      />

      {tab === "account" ? (
        <div className="ez-stack ez-stack--lg">
          <SettingsCard
            title="Account"
            footer={
              <Button disabled={saving} onClick={() => void saveAccount()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            }
          >
            <div className="ez-form-grid">
              <TextField
                label="Your name"
                value={name}
                autoComplete="name"
                onChange={({ target: { value } }) => setName(value)}
              />
              <TextField
                label="Email"
                type="email"
                value={user?.email ?? ""}
                readOnly
                onChange={() => undefined}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            title="Tour"
            footer={
              <Button variant="secondary" icon={<Route size={18} strokeWidth={1.75} aria-hidden />} onClick={openReplay}>
                Show tour again
              </Button>
            }
          >
            <p className="ez-small">Replay the welcome tour for clients.</p>
          </SettingsCard>

          <SecurityCard />

          <CloseAccountCard
            copy={{
              cardDescription:
                "Closing is permanent. Finish or cancel open bookings before you close your account.",
              modalTitle: "Close your account",
              modalBody: "Enter your password to confirm. This cannot be undone.",
              cancelLabel: "Cancel",
              confirmLabel: "Close account",
            }}
          />
        </div>
      ) : null}

      {tab === "privacy" ? (
        <div className="ez-stack ez-stack--lg">
          {contact ? (
            <ContactSharingCard
              copy={{
                cardTitle: "Contact sharing",
                emailTitle: "Share my email with vendors",
                phoneTitle: "Share my phone with vendors",
                phoneDetail: "When you add a number to bookings",
              }}
              contact={contact}
              saving={contactSaving}
              onToggle={(key) => void toggleContact(key)}
            />
          ) : (
            <LottieFailureInline message="Could not load privacy settings." />
          )}

          <SettingsCard title="Notifications">
            <Link href={portalRoute("client", "notifications")} className="ez-list-row">
              <span className="ez-avatar" aria-hidden>
                <Bell size={18} />
              </span>
              <div className="ez-list-row__main">
                <span className="ez-strong">All notifications</span>
                <span className="ez-small">Booking updates and messages</span>
              </div>
              <ChevronRight size={18} aria-hidden />
            </Link>
          </SettingsCard>
        </div>
      ) : null}

      {tab === "more" ? (
        <div className="ez-stack ez-stack--lg">
          <SettingsCard title="Shortcuts" bodyClassName="ez-stack ez-stack--sm">
            <Link href={portalRoute("client", "bookings")} className="ez-list-row">
              <CalendarDays size={18} aria-hidden />
              <div className="ez-list-row__main">
                <span className="ez-strong">My bookings</span>
                <span className="ez-small">Bookings and payments</span>
              </div>
              <ChevronRight size={18} aria-hidden />
            </Link>
            <Link href={portalRoute("client", "disputes")} className="ez-list-row">
              <ShieldAlert size={18} aria-hidden />
              <div className="ez-list-row__main">
                <span className="ez-strong">Disputes</span>
                <span className="ez-small">Open cases</span>
              </div>
              <ChevronRight size={18} aria-hidden />
            </Link>
          </SettingsCard>

          <PolicyLinksCard />
        </div>
      ) : null}
    </div>
  );
}
