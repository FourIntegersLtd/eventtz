"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { initialVendorOnboardingData, type VendorOnboardingData } from "@/lib/vendorOnboarding/types";
import {
  mergePayloadIntoVendorData,
  normalizeVendorPayload,
  vendorDataToPayload,
} from "@/features/vendor/onboarding/serializeVendorPayload";
import {
  CloseAccountCard,
  ContactSharingCard,
  PolicyLinksCard,
  SecurityCard,
  SettingToggleRow,
  SettingsCard,
  useContactSharing,
} from "@/features/settings/SettingsCards";
import { VendorReferralsTab } from "@/features/settings/VendorReferralsTab";
import { fetchVendorProfile, saveVendorProfile } from "@/lib/vendorProfileApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { isValidPhoneNumber } from "@/lib/validation/phone";

const VENDOR_SETTINGS_TABS = [
  { value: "account", label: "Account" },
  { value: "referrals", label: "Referrals" },
] as const;

/**
 * Vendor settings (design V31): one page for account, notifications, security,
 * closing the account, and the client referral link. Client settings live in
 * `ClientSettingsEzView`; both are built from the shared `SettingsCards`.
 */
export function VendorSettingsEzView() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "referrals" ? "referrals" : "account";
  const { contact, saving: contactSaving, toggle: toggleContact } = useContactSharing(
    "Contact preferences saved",
    "Could not save contact preferences",
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileStep, setProfileStep] = useState(1);
  const [data, setData] = useState<VendorOnboardingData>(initialVendorOnboardingData);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchVendorProfile();
        if (cancelled) return;
        const merged = mergePayloadIntoVendorData(
          normalizeVendorPayload(profile.profile_form_data),
          user?.email ?? "",
        );
        setProfileStep(profile.current_step || 1);
        setData({
          ...initialVendorOnboardingData,
          ...merged,
          email: merged.email?.trim() || user?.email || "",
          password: "",
        });
      } catch {
        if (!cancelled) setLoadError("Could not load your account.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const saveAccount = async () => {
    if (!data.firstName.trim() || !data.lastName.trim()) {
      showToast({ title: "Enter your first and last name", tone: "error" });
      return;
    }
    if (!isValidPhoneNumber(data.phone.trim())) {
      setPhoneError("Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).");
      return;
    }
    setSaving(true);
    setPhoneError(null);
    try {
      const res = await saveVendorProfile({
        current_step: profileStep,
        profile_form_data: vendorDataToPayload({ ...data, email: user?.email ?? data.email }),
      });
      setProfileStep(res.current_step || profileStep);
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

  if (loadError) {
    return <LottieFailureInline message={loadError} />;
  }

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader
        descriptionSize="body"
        eyebrow="Account"
        title="Settings"
        description="Your sign-in, notifications and referrals."
      />

      <Tabs
        aria-label="Settings sections"
        options={VENDOR_SETTINGS_TABS}
        value={tab}
        onChange={(next) => router.push(next === "account" ? "/vendor/settings" : `/vendor/settings?tab=${next}`)}
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
                label="First name"
                value={data.firstName}
                autoComplete="given-name"
                onChange={({ target: { value } }) => setData((prev) => ({ ...prev, firstName: value }))}
              />
              <TextField
                label="Last name"
                value={data.lastName}
                autoComplete="family-name"
                onChange={({ target: { value } }) => setData((prev) => ({ ...prev, lastName: value }))}
              />
              <TextField
                label="Email"
                type="email"
                value={user?.email ?? data.email}
                readOnly
                onChange={() => undefined}
              />
              <TextField
                label="Phone number"
                type="tel"
                value={data.phone}
                autoComplete="tel"
                error={phoneError}
                onChange={({ target: { value } }) => {
                  setData((prev) => ({ ...prev, phone: value }));
                  setPhoneError(null);
                }}
              />
            </div>
          </SettingsCard>

          <SettingsCard title="Notifications">
            <SettingToggleRow
              title="New enquiries"
              detail="Email and in-app"
              checked={data.emailOnEnquiry}
              onChange={(checked) => setData((prev) => ({ ...prev, emailOnEnquiry: checked }))}
            />
            <SettingToggleRow
              title="Payments and payouts"
              detail="Always on for security"
              checked
              disabled
              onChange={() => undefined}
            />
            <p className="ez-caption mt-2">
              Enquiry emails save with Save changes. Payment emails cannot be turned off.
            </p>
          </SettingsCard>

          {contact ? (
            <ContactSharingCard
              copy={{
                cardTitle: "What clients see after they pay",
                emailTitle: "Share my email",
                phoneTitle: "Share my phone",
                phoneDetail: "From your profile",
              }}
              contact={contact}
              saving={contactSaving}
              onToggle={(key) => void toggleContact(key)}
            />
          ) : null}

          <SecurityCard showSignInLine />

          <CloseAccountCard
            copy={{
              cardDescription:
                "Closing is permanent. Open bookings must be completed or cancelled first, and held payouts will still be paid.",
              modalTitle: "Close your account?",
              modalBody:
                "This cannot be undone. You will be signed out. You can register again later with the same email; it will be a new account.",
              cancelLabel: "Keep account",
              confirmLabel: "Close my account",
            }}
          />

          <PolicyLinksCard />
        </div>
      ) : (
        <VendorReferralsTab />
      )}
    </div>
  );
}
