"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  postReviewVendorPackages,
  type PackageCoachPackageFeedback,
  type PackageCoachResult,
  vendorOnboardingAiErrorMessage,
} from "@/lib/vendorOnboardingAiApi";
import {
  applyPackageCoachSuggestions,
  storeCoachScrollTarget,
} from "../packageCoachApply";
import { vendorDataToPayload } from "../serializeVendorPayload";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";

const PACKAGE_COACH_HASH_KEY = "eventtz-package-coach-hash";

function packagesHash(data: VendorOnboardingData): string {
  return JSON.stringify({
    services: data.servicesOffered,
    packages: data.packages.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      details: p.details,
      duration: p.duration,
    })),
    bio: data.aiBioDraft.slice(0, 200),
    portfolio: data.portfolioFileNamesPersisted.length + data.portfolioFiles.length,
  });
}

function packageFeedbackList(result: PackageCoachResult | null): PackageCoachPackageFeedback[] {
  if (!result) return [];
  if (result.package_feedback?.length) return result.package_feedback;

  const tips = result.tips ?? [];
  if (!tips.length) return [];

  const grouped = new Map<string, PackageCoachPackageFeedback>();
  for (const tip of tips) {
    const title = tip.package_title?.trim() || "Overall";
    const key = tip.package_id ?? title;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.items.includes(tip.message)) existing.items.push(tip.message);
    } else {
      grouped.set(key, {
        package_id: tip.package_id,
        package_title: title,
        items: [tip.message],
      });
    }
  }
  return [...grouped.values()];
}

type CoachOpts = {
  autoRun?: boolean;
  onApplied?: (updatedIds: string[]) => void;
};

export function usePackageCoach(
  data: VendorOnboardingData,
  update: VendorOnboardingUpdate,
  opts?: CoachOpts,
) {
  const [result, setResult] = useState<PackageCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = vendorDataToPayload(data);
      const res = await postReviewVendorPackages(payload);
      const { packages: nextPackages, updatedIds } = applyPackageCoachSuggestions(
        data.packages,
        res.package_feedback ?? [],
      );

      if (updatedIds.length > 0) {
        update({ packages: nextPackages });
        storeCoachScrollTarget(updatedIds);
        opts?.onApplied?.(updatedIds);
        setResult({
          ...res,
          applied_package_ids: updatedIds,
          summary: "",
          package_feedback: [],
          tips: [],
        });
      } else {
        setResult(res);
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(PACKAGE_COACH_HASH_KEY, packagesHash(data));
      }
    } catch (err) {
      setError(vendorOnboardingAiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [data, update, opts?.onApplied]);

  const maybeAutoRun = useCallback(async () => {
    if (!opts?.autoRun) return;
    const hash = packagesHash(data);
    if (typeof window !== "undefined") {
      const prev = sessionStorage.getItem(PACKAGE_COACH_HASH_KEY);
      if (prev === hash) return;
    }
    await runCheck();
  }, [data, opts?.autoRun, runCheck]);

  return { result, loading, error, runCheck, maybeAutoRun };
}

type PanelProps = {
  result: PackageCoachResult | null;
  loading: boolean;
  error: string | null;
  onCheck: () => void | Promise<void>;
  className?: string;
  showButton?: boolean;
  variant?: "compact" | "prominent";
};

export function PackageCoachPanel({
  result,
  loading,
  error,
  onCheck,
  className = "",
  showButton = true,
  variant = "prominent",
}: PanelProps) {
  const applied = Boolean(result?.applied_package_ids?.length);
  const feedback = applied ? [] : packageFeedbackList(result);
  const hasOverallOnly =
    !applied && feedback.length > 0 && feedback.every(
      (f) => f.package_title.trim().toLowerCase() === "overall",
    );

  return (
    <div
      className={`rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-4 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">AI package review</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            {variant === "prominent"
              ? "We fill in improved names and descriptions directly."
              : "AI updates your package fields when possible."}
          </p>
        </div>
        {showButton ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void onCheck()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {loading ? "Updating…" : "Help me improve my packages"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}

      {applied ? (
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900">
          <p>
            We&apos;ve updated your packages. Please review the highlighted packages and check
            everything is accurate. AI can make mistakes.
          </p>
        </div>
      ) : null}

      {!applied && feedback.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {feedback.map((pkg) => (
            <li
              key={pkg.package_id ?? pkg.package_title}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-3 shadow-sm"
            >
              <p className="text-sm font-semibold text-neutral-900">{pkg.package_title}</p>
              {pkg.items.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-neutral-700">
                  {pkg.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!applied && !feedback.length && result?.summary && !loading ? (
        <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          {result.summary}
        </p>
      ) : null}

      {hasOverallOnly ? (
        <p className="mt-2 text-xs text-neutral-500">
          Add any missing packages manually. We can only auto-fill existing ones.
        </p>
      ) : null}
    </div>
  );
}
