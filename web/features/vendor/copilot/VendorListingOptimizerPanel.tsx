"use client";

import { useCallback, useState } from "react";
import {
  postCopilotReviewPackages,
  type CopilotReviewPackagesResult,
  vendorCopilotErrorMessage,
} from "@/lib/vendorCopilotApi";
import {
  applyPackageCoachSuggestions,
  storeCoachScrollTarget,
} from "@/features/vendor/onboarding/packageCoachApply";
import { vendorDataToPayload } from "@/features/vendor/onboarding/serializeVendorPayload";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "@/features/vendor/onboarding/types";
import { PackageCoachPanel } from "@/features/vendor/onboarding/ui/PackageCoachPanel";
import type { PackageCoachResult } from "@/lib/vendorOnboardingAiApi";

function toCoachResult(result: CopilotReviewPackagesResult): PackageCoachResult {
  return {
    overall_ok: result.overall_ok,
    summary: result.summary,
    package_feedback: result.package_feedback,
  };
}

export function useListingOptimizer(
  data: VendorOnboardingData,
  update: VendorOnboardingUpdate,
  opts?: { onApplied?: (updatedIds: string[]) => void },
) {
  const [result, setResult] = useState<PackageCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = vendorDataToPayload(data);
      const res = await postCopilotReviewPackages(payload);
      const { packages: nextPackages, updatedIds } = applyPackageCoachSuggestions(
        data.packages,
        res.package_feedback,
      );
      if (updatedIds.length > 0) {
        update({ packages: nextPackages });
        storeCoachScrollTarget(updatedIds);
        setResult({ ...toCoachResult(res), applied_package_ids: updatedIds });
        opts?.onApplied?.(updatedIds);
      } else {
        setResult(toCoachResult(res));
      }
    } catch (e: unknown) {
      setError(vendorCopilotErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [data, update, opts]);

  return { result, loading, error, runCheck };
}

type PanelProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  className?: string;
};

export function VendorListingOptimizerPanel({ data, update, className = "" }: PanelProps) {
  const coach = useListingOptimizer(data, update);

  return (
    <PackageCoachPanel
      result={coach.result}
      loading={coach.loading}
      error={coach.error}
      onCheck={coach.runCheck}
      className={className}
      variant="compact"
    />
  );
}
