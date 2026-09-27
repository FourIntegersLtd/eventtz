"use client";

import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, Spinner } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { fetchContactSettings, saveContactSettings, type ContactSharingSettings } from "@/domains/vendor-settings/api";

/** One on/off preference row, styled as a labelled checkbox. */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-neutral-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-primary-border text-primary focus:ring-primary-border"
      />
    </label>
  );
}

/**
 * `/vendor/settings` — account email and contact-sharing preferences.
 *
 * Simplified from the baseline's tabbed `SettingsView` (account/privacy/
 * referrals/more): this workstream owns only the contact-sharing settings
 * (`GET/PUT /user/contact-settings`); sign-out, referrals, and account
 * deletion are other slices' work and are not duplicated here.
 */
export function SettingsView() {
  const { session } = useSession();
  const [settings, setSettings] = useState<ContactSharingSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await fetchContactSettings();
        if (!cancelled) setSettings(result);
      } catch (cause: unknown) {
        if (!cancelled) setLoadError(platformErrorDetail(cause) ?? "Could not load your settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(field: "share_email" | "share_phone", value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [field]: value });
    setSaving(true);
    setSaveError(null);
    setSaveNote(null);
    try {
      const result = await saveContactSettings({ [field]: value });
      setSettings(result);
      setSaveNote("Saved.");
    } catch (cause: unknown) {
      setSettings(previous);
      setSaveError(platformErrorDetail(cause) ?? "Could not save that change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-neutral-900">Settings</h1>

      <Card className="space-y-1">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Account</h2>
        <p className="text-sm text-neutral-600">{session?.user.email}</p>
      </Card>

      <Card>
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Contact sharing</h2>
        <p className="mt-1 text-sm text-neutral-500">Choose what clients you&apos;ve booked with can see.</p>

        {loading ? (
          <div className="mt-4">
            <Spinner label="Loading settings…" />
          </div>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700">{loadError}</p>
        ) : settings ? (
          <div className="mt-4 divide-y divide-neutral-100">
            <ToggleRow label="Share my email" checked={settings.share_email} onChange={(value) => void toggle("share_email", value)} />
            <ToggleRow label="Share my phone number" checked={settings.share_phone} onChange={(value) => void toggle("share_phone", value)} />
          </div>
        ) : null}

        {saving ? <p className="mt-3 text-sm text-neutral-500">Saving…</p> : null}
        {!saving && saveError ? <p className="mt-3 text-sm text-red-700">{saveError}</p> : null}
        {!saving && saveNote ? <p className="mt-3 text-sm text-emerald-700">{saveNote}</p> : null}
      </Card>
    </div>
  );
}
