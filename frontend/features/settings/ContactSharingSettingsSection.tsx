"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchContactSharingSettings,
  updateContactSharingSettings,
  type ContactSharingSettings,
} from "@/lib/userSettingsApi";
import { parseForm, contactPhoneFormSchema } from "@/lib/validation";
import { LoadingState } from "@/components/ui/LoadingState";
import { inputClass, labelClass } from "@/features/vendor/onboarding/steps/form-primitives";
import type { PortalRole } from "@/components/portal-shell/portalNav";

export type ContactSharingSettingsSectionProps = {
  role: PortalRole;
};

export function ContactSharingSettingsSection({ role }: ContactSharingSettingsSectionProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ContactSharingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isVendor = role === "vendor";

  useEffect(() => {
    void fetchContactSharingSettings()
      .then(setSettings)
      .catch(() => setError("Could not load contact preferences."));
  }, []);

  const toggle = async (
    key: keyof Pick<ContactSharingSettings, "share_email" | "share_phone">,
  ) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const next = { ...settings, [key]: !settings[key] };
    try {
      const updated = await updateContactSharingSettings({ [key]: next[key] });
      setSettings(updated);
      setSaved(true);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async (phone: string) => {
    if (!settings) return;
    const parsed = parseForm(contactPhoneFormSchema, { phone });
    if (!parsed.ok) {
      setError(parsed.formError);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateContactSharingSettings({
        contact_phone: parsed.data.phone,
      });
      setSettings(updated);
      setSaved(true);
    } catch {
      setError("Could not save phone number.");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <section className={`${portalCard} ${portalCardPadding}`}>
        <LoadingState label="Loading contact preferences…" variant="inline" />
      </section>
    );
  }

  return (
    <section className={`${portalCard} ${portalCardPadding}`}>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">
        {isVendor ? "Contact" : "After you pay"}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        {isVendor
          ? "What clients see once they've paid."
          : "Email and phone stay hidden until you pay."}
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-xs font-medium text-primary">Saved.</p>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.share_email}
            disabled={saving}
            onChange={() => void toggle("share_email")}
          />
          <span>
            Share my email
            {!isVendor && user?.email ? (
              <span className="mt-0.5 block text-xs text-neutral-500">{user.email}</span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.share_phone}
            disabled={saving}
            onChange={() => void toggle("share_phone")}
          />
          <span>
            Share my phone
            {isVendor ? (
              <span className="mt-0.5 block text-xs text-neutral-500">From your profile</span>
            ) : (
              <span className="mt-0.5 block text-xs text-neutral-500">Add a number below</span>
            )}
          </span>
        </label>
      </div>

      {!isVendor ? (
        <div className="mt-5">
          <label className={labelClass()} htmlFor="settings-contact-phone">
            Phone (optional)
          </label>
          <input
            id="settings-contact-phone"
            type="tel"
            className={inputClass()}
            defaultValue={settings.contact_phone ?? ""}
            placeholder="e.g. 07xxx xxxxxx"
            disabled={saving}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (settings.contact_phone ?? "")) void savePhone(v);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
