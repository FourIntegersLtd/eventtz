"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Button, Card, Spinner, TextField } from "@/foundation/ui";
import {
  fetchVendorProfile,
  generateVendorBio,
  reviewVendorPackages,
  saveVendorProfile,
  type VendorProfileFormData,
  type VendorProfileState,
} from "@/domains/vendor-profile/api";
import { PortfolioSection } from "@/domains/vendor-profile/PortfolioSection";
import { profileStatusBanner } from "@/domains/vendor-profile/profileStatus";
import { VENDOR_SERVICE_OPTIONS } from "@/domains/vendor-profile/serviceCategories";

const BANNER_CLASS: Record<"info" | "warning" | "success", string> = {
  info: "bg-sky-50 text-sky-900 ring-sky-200/60",
  warning: "bg-amber-50 text-amber-900 ring-amber-200/60",
  success: "bg-emerald-50 text-emerald-900 ring-emerald-200/60",
};

/**
 * The vendor onboarding form, reused (as in the baseline) for post-approval
 * edits: business name, bio (with an AI-generate helper), one service
 * category, portfolio photos, and a submit-for-review action.
 *
 * This is a simplified rebuild of the baseline's nine-step wizard
 * (`VendorOnboarding.tsx`) — one page covering the same fields, not a
 * pixel-identical port (see this workstream's brief).
 */
export function ProfileView() {
  const [profile, setProfile] = useState<VendorProfileState | null>(null);
  const [formData, setFormData] = useState<VendorProfileFormData>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const [generatingBio, setGeneratingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [reviewingPackages, setReviewingPackages] = useState(false);
  const [packageSummary, setPackageSummary] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await fetchVendorProfile();
        if (cancelled) return;
        setProfile(result);
        setFormData((result.profile_form_data as VendorProfileFormData | undefined) ?? {});
      } catch (cause: unknown) {
        if (!cancelled) setLoadError(platformErrorDetail(cause) ?? "Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<Key extends keyof VendorProfileFormData>(key: Key, value: VendorProfileFormData[Key]) {
    setFormData((previous) => ({ ...previous, [key]: value }));
  }

  async function save(status?: "draft" | "submitted") {
    setSaving(true);
    setSaveError(null);
    setSaveNote(null);
    try {
      const result = await saveVendorProfile({
        current_step: profile?.current_step ?? 1,
        profile_form_data: formData,
        status,
      });
      setProfile(result);
      setSaveNote(status === "submitted" ? "Submitted for review." : "Saved.");
    } catch (cause: unknown) {
      setSaveError(platformErrorDetail(cause) ?? "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateBio() {
    setGeneratingBio(true);
    setBioError(null);
    try {
      const bio = await generateVendorBio(formData);
      updateField("bio", bio);
    } catch (cause: unknown) {
      setBioError(platformErrorDetail(cause) ?? "Could not generate a bio. Try again.");
    } finally {
      setGeneratingBio(false);
    }
  }

  async function onReviewPackages() {
    setReviewingPackages(true);
    setPackageError(null);
    setPackageSummary(null);
    try {
      const result = await reviewVendorPackages(formData);
      setPackageSummary(result.summary || (result.overall_ok ? "Your packages look good." : "Some packages need attention."));
    } catch (cause: unknown) {
      setPackageError(platformErrorDetail(cause) ?? "Could not review your packages. Try again.");
    } finally {
      setReviewingPackages(false);
    }
  }

  if (loading) return <Spinner label="Loading your profile…" />;

  if (loadError) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/50">{loadError}</p>;
  }

  if (!profile) return null;

  const banner = profileStatusBanner(profile);
  const portfolioUrls = formData.portfolioFileNames ?? [];

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Vendor profile</h1>
        <Link href="/vendor/profile/reviews" className="text-sm font-medium text-primary hover:underline">
          View client reviews →
        </Link>
      </div>

      {banner.tone !== "none" ? (
        <p className={`rounded-xl px-4 py-3 text-sm ring-1 ${BANNER_CLASS[banner.tone]}`}>{banner.message}</p>
      ) : null}

      <Card className="space-y-4">
        <TextField
          label="Business name"
          value={formData.businessName ?? ""}
          onChange={(event) => updateField("businessName", event.target.value)}
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Service category</span>
          <select
            value={formData.servicesOffered ?? ""}
            onChange={(event) => updateField("servicesOffered", event.target.value)}
            className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
          >
            <option value="">Choose a category…</option>
            {VENDOR_SERVICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700">Bio</span>
            <Button type="button" variant="secondary" loading={generatingBio} onClick={() => void onGenerateBio()}>
              Generate with AI
            </Button>
          </div>
          <textarea
            value={formData.bio ?? ""}
            onChange={(event) => updateField("bio", event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
          />
          {bioError ? <p className="mt-1 text-sm text-red-700">{bioError}</p> : null}
        </div>
      </Card>

      <PortfolioSection imageUrls={portfolioUrls} onChange={(urls) => updateField("portfolioFileNames", urls)} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Package coach</h2>
          <Button type="button" variant="secondary" loading={reviewingPackages} onClick={() => void onReviewPackages()}>
            Review my packages with AI
          </Button>
        </div>
        {packageError ? <p className="text-sm text-red-700">{packageError}</p> : null}
        {packageSummary ? <p className="text-sm text-neutral-700">{packageSummary}</p> : null}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" loading={saving} onClick={() => void save()}>
          Save changes
        </Button>
        <Button type="button" variant="secondary" loading={saving} onClick={() => void save("submitted")}>
          Submit for review
        </Button>
        {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}
        {saveNote ? <p className="text-sm text-emerald-700">{saveNote}</p> : null}
      </div>
    </div>
  );
}
