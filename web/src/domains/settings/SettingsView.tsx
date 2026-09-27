"use client";

import { useEffect, useState, type ReactNode } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Card, LoadingState } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { fetchContactSettings, saveContactSettings, type ContactSharingSettings } from "@/domains/settings/api";
import { contactSharingCopy, type SettingsRole } from "@/domains/settings/contactSharingCopy";
import { parseContactPhone } from "@/domains/settings/contactPhone";

/** One on/off preference row, styled as a labelled checkbox with an optional sub-label. */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-neutral-800">
        {label}
        {description ? <span className="mt-0.5 block text-xs text-neutral-500">{description}</span> : null}
      </span>
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
 * `/settings` for one portal — account email and contact-sharing preferences.
 *
 * Shared by the client and vendor portals (the baseline's `SettingsView`
 * takes a `role` for the same reason); only the card copy and the
 * client-only phone field differ by role. Simplified from the baseline's
 * tabbed `SettingsView`: sign-out, referrals and account deletion are other
 * slices' work and are not duplicated here.
 */
export function SettingsView({ role, extraSections }: { role: SettingsRole; extraSections?: ReactNode }) {
  const { session } = useSession();
  const [settings, setSettings] = useState<ContactSharingSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const isClient = role === "client";
  const copy = contactSharingCopy(role);

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

  /** Save the client's optional phone on blur, only when the trimmed value actually changed. */
  async function savePhone(raw: string) {
    if (!settings) return;
    const parsed = parseContactPhone(raw);
    if (!parsed.ok) {
      setSaveError(parsed.error);
      return;
    }
    if (parsed.value === (settings.contact_phone ?? null)) return;
    setSaving(true);
    setSaveError(null);
    setSaveNote(null);
    try {
      const result = await saveContactSettings({ contact_phone: parsed.value });
      setSettings(result);
      setSaveNote("Phone number saved.");
    } catch (cause: unknown) {
      setSaveError(platformErrorDetail(cause) ?? "Could not save phone number.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-neutral-900">Settings</h1>

      <Card padding="lg" className="space-y-1">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Account</h2>
        <p className="text-sm text-neutral-600">{session?.user.email}</p>
      </Card>

      <Card padding="lg">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">{copy.title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{copy.description}</p>

        {loading ? (
          <div className="mt-4">
            <LoadingState variant="inline" label="Loading settings…" />
          </div>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700">{loadError}</p>
        ) : settings ? (
          <div className="mt-4 divide-y divide-neutral-100">
            <ToggleRow
              label="Share my email"
              description={isClient ? session?.user.email : undefined}
              checked={settings.share_email}
              onChange={(value) => void toggle("share_email", value)}
            />
            <ToggleRow
              label={isClient ? "Share my phone" : "Share my phone number"}
              description={isClient ? "Add a number below" : undefined}
              checked={settings.share_phone}
              onChange={(value) => void toggle("share_phone", value)}
            />
            {isClient ? (
              <div className="pt-3">
                <label htmlFor="settings-contact-phone" className="mb-1 block text-sm text-neutral-700">
                  Phone (optional)
                </label>
                <input
                  id="settings-contact-phone"
                  type="tel"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  defaultValue={settings.contact_phone ?? ""}
                  placeholder="e.g. 07xxx xxxxxx"
                  disabled={saving}
                  onBlur={(event) => void savePhone(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {saving ? <p className="mt-3 text-sm text-neutral-500">Saving…</p> : null}
        {!saving && saveError ? <p className="mt-3 text-sm text-red-700">{saveError}</p> : null}
        {!saving && saveNote ? <p className="mt-3 text-sm text-emerald-700">{saveNote}</p> : null}
      </Card>

      {extraSections}
    </div>
  );
}
