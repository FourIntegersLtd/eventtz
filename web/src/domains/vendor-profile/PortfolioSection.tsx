"use client";

import { useRef, useState } from "react";
import { platformErrorDetail } from "@/foundation/platform-client";
import { Button, Card } from "@/foundation/ui";
import { analyzePortfolioImage } from "@/domains/vendor-profile/api";

export interface PortfolioSectionProps {
  imageUrls: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Portfolio photo URLs, plus an AI portfolio-photo check.
 *
 * There is no image-upload/storage endpoint in this workstream's scope
 * (the baseline uploads straight to S3, which is not wired up here yet), so
 * photos are added by pasting a public URL. The "Check a photo with AI"
 * button is a separate, honest affordance: it sends a local file straight to
 * `POST /vendor/onboarding/ai/analyze-portfolio-image` for feedback, without
 * pretending that upload also adds it to the list below.
 */
export function PortfolioSection({ imageUrls, onChange }: PortfolioSectionProps) {
  const [draftUrl, setDraftUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; score: number; summary: string } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addUrl() {
    const trimmed = draftUrl.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed) || imageUrls.includes(trimmed)) return;
    onChange([...imageUrls, trimmed]);
    setDraftUrl("");
  }

  function removeUrl(url: string) {
    onChange(imageUrls.filter((existing) => existing !== url));
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const result = await analyzePortfolioImage(file);
      setCheckResult(result);
    } catch (cause: unknown) {
      setCheckError(platformErrorDetail(cause) ?? "Could not check that photo. Try again.");
    } finally {
      setChecking(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Portfolio photos</h2>
        <p className="mt-1 text-sm text-neutral-500">Add public photo URLs — clients see these on your listing.</p>
      </div>

      <ul className="space-y-2">
        {imageUrls.map((url) => (
          <li key={url} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-neutral-700">{url}</span>
            <button type="button" onClick={() => removeUrl(url)} className="shrink-0 text-red-600 hover:underline">
              Remove
            </button>
          </li>
        ))}
        {imageUrls.length === 0 ? <li className="text-sm text-neutral-500">No portfolio photos yet.</li> : null}
      </ul>

      <div className="flex gap-2">
        <input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          placeholder="https://…"
          className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
        />
        <Button type="button" variant="secondary" onClick={addUrl}>
          Add
        </Button>
      </div>

      <div className="border-t border-neutral-100 pt-4">
        <label className="block text-sm font-medium text-neutral-700">Check a photo with AI before you host it</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(event) => void onFileChosen(event.target.files?.[0])}
          disabled={checking}
          className="mt-2 text-sm"
        />
        {checking ? <p className="mt-2 text-sm text-neutral-500">Checking…</p> : null}
        {checkError ? <p className="mt-2 text-sm text-red-700">{checkError}</p> : null}
        {checkResult ? (
          <p className={`mt-2 text-sm ${checkResult.ok ? "text-emerald-700" : "text-amber-700"}`}>
            Score {checkResult.score}/100 — {checkResult.summary}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
