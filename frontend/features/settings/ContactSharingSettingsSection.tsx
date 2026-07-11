"use client";

import { useEffect, useState } from "react";
import {
  fetchContactSharingSettings,
  updateContactSharingSettings,
  type ContactSharingSettings,
} from "@/lib/userSettingsApi";
import { inputClass, labelClass } from "@/components/vendor-onboarding/steps/form-primitives";

export function ContactSharingSettingsSection() {
  const [settings, setSettings] = useState<ContactSharingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchContactSharingSettings()
      .then(setSettings)
      .catch(() => setError("Could not load contact preferences."));
  }, []);

  const toggle = async (key: keyof Pick<ContactSharingSettings, "share_email" | "share_phone" | "share_address">) => {
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
      setError("Could not save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async (phone: string) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateContactSharingSettings({ contact_phone: phone.trim() || null });
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
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <p className="text-sm text-neutral-500">Loading contact preferences…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Contact sharing</h2>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-xs font-medium text-primary">Preferences saved.</p>
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
          <span>Share my email</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.share_phone}
            disabled={saving}
            onChange={() => void toggle("share_phone")}
          />
          <span>Share my phone number</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.share_address}
            disabled={saving}
            onChange={() => void toggle("share_address")}
          />
          <span>Share event address</span>
        </label>
      </div>

      <div className="mt-5">
        <label className={labelClass()} htmlFor="settings-contact-phone">
          Phone number (optional)
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
    </section>
  );
}
