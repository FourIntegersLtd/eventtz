"use client";

import { useSearchParams } from "next/navigation";
import {
  VENDOR_DESIGN_FIXTURE_IDS,
  type VendorDesignFixtureId,
} from "@/features/vendor/design/vendorDesignFixtureHtml";

/** True when design-diff navigates with ``?designStatic=1`` to render fixture markup. */
export function useDesignDiffStatic(): boolean {
  const searchParams = useSearchParams();
  return searchParams.get("designStatic") === "1";
}

export function useDesignDiffPayoutPreview(): boolean {
  const searchParams = useSearchParams();
  return searchParams.get("payoutPreview") === "1";
}

/** Normalises ``designFixture=v17`` / ``V17-RequestDetail`` to a fixture id, or null. */
export function normalizeDesignFixtureParam(raw: string | null): VendorDesignFixtureId | null {
  if (!raw) return null;
  const lowered = raw.trim().toLowerCase();
  const byId = VENDOR_DESIGN_FIXTURE_IDS.find((fixtureId) => fixtureId === lowered);
  if (byId) return byId;
  const screenMatch = lowered.match(/^v(\d+)/);
  if (screenMatch) {
    const candidate = `v${screenMatch[1]}` as VendorDesignFixtureId;
    if (VENDOR_DESIGN_FIXTURE_IDS.includes(candidate)) return candidate;
  }
  return null;
}

/** Active V17–V31 fixture when ``designStatic=1`` and ``designFixture`` is set. */
export function useDesignDiffFixture(): VendorDesignFixtureId | null {
  const searchParams = useSearchParams();
  if (searchParams.get("designStatic") !== "1") return null;
  return normalizeDesignFixtureParam(searchParams.get("designFixture"));
}
