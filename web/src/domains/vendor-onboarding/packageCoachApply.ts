/** packageCoachApply for the vendor onboarding wizard. */

import type { PackageCoachPackageFeedback } from "@/domains/vendor-onboarding/api";
import type { VendorPackageItem } from "./types";

export const COACH_SCROLL_PACKAGE_KEY = "eventtz-coach-scroll-package";
export const COACH_HIGHLIGHT_PACKAGES_KEY = "eventtz-coach-highlight-packages";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^\w\s]/g, " ");
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function similarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = shorter === na ? nb : na;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.7) return 0.9;
  let matches = 0;
  const aWords = new Set(na.split(/\s+/).filter(Boolean));
  for (const word of nb.split(/\s+/)) {
    if (word && aWords.has(word)) matches += 1;
  }
  const total = Math.max(aWords.size, nb.split(/\s+/).filter(Boolean).length);
  return total ? matches / total : 0;
}

function shouldApplyTitle(current: string, suggested: string): boolean {
  const next = suggested.trim();
  if (!next || wordCount(next) < 3) return false;
  const cur = current.trim();
  if (!cur) return true;
  if (similarity(next, cur) >= 0.72) return false;
  if (next.length <= cur.length && similarity(next, cur) >= 0.55) return false;
  return next !== cur;
}

function shouldApplyDetails(current: string, suggested: string): boolean {
  const next = suggested.trim();
  if (!next || next.length < 40) return false;
  const cur = current.trim();
  if (!cur) return true;
  if (similarity(next, cur) >= 0.68) return false;
  return next !== cur;
}

function shouldApplyDuration(current: string, suggested: string): boolean {
  const next = suggested.trim();
  if (!next) return false;
  const cur = current.trim();
  if (!cur) return true;
  if (similarity(next, cur) >= 0.8) return false;
  return next !== cur;
}

function findPackageIndex(
  packages: VendorPackageItem[],
  fb: PackageCoachPackageFeedback,
): number {
  if (fb.package_id) {
    const byId = packages.findIndex((p) => p.id === fb.package_id);
    if (byId >= 0) return byId;
  }
  const title = norm(fb.package_title);
  if (!title || title === "overall") return -1;
  return packages.findIndex((p) => norm(p.title) === title);
}

function hasSuggestedFields(fb: PackageCoachPackageFeedback): boolean {
  return Boolean(
    fb.suggested_title?.trim() ||
      fb.suggested_details?.trim() ||
      fb.suggested_duration?.trim(),
  );
}

export function applyPackageCoachSuggestions(
  packages: VendorPackageItem[],
  feedback: PackageCoachPackageFeedback[],
): { packages: VendorPackageItem[]; updatedIds: string[] } {
  const next = packages.map((p) => ({ ...p }));
  const updatedIds: string[] = [];

  for (const fb of feedback) {
    if (!hasSuggestedFields(fb)) continue;
    const idx = findPackageIndex(next, fb);
    if (idx < 0) continue;

    const pkg = next[idx]!;
    let changed = false;

    if (fb.suggested_title?.trim() && shouldApplyTitle(pkg.title, fb.suggested_title)) {
      pkg.title = fb.suggested_title.trim();
      changed = true;
    }
    if (fb.suggested_details?.trim() && shouldApplyDetails(pkg.details, fb.suggested_details)) {
      pkg.details = fb.suggested_details.trim();
      changed = true;
    }
    if (fb.suggested_duration?.trim() && shouldApplyDuration(pkg.duration, fb.suggested_duration)) {
      pkg.duration = fb.suggested_duration.trim();
      changed = true;
    }

    if (changed && !updatedIds.includes(pkg.id)) updatedIds.push(pkg.id);
  }

  return { packages: next, updatedIds };
}

export function storeCoachScrollTarget(packageIds: string[]): void {
  if (typeof window === "undefined" || packageIds.length === 0) return;
  sessionStorage.setItem(COACH_SCROLL_PACKAGE_KEY, packageIds[0]!);
  sessionStorage.setItem(COACH_HIGHLIGHT_PACKAGES_KEY, JSON.stringify(packageIds));
}

export function consumeCoachScrollTarget(): {
  scrollToId: string | null;
  highlightIds: string[];
} {
  if (typeof window === "undefined") {
    return { scrollToId: null, highlightIds: [] };
  }
  const scrollToId = sessionStorage.getItem(COACH_SCROLL_PACKAGE_KEY);
  const rawHighlight = sessionStorage.getItem(COACH_HIGHLIGHT_PACKAGES_KEY);
  sessionStorage.removeItem(COACH_SCROLL_PACKAGE_KEY);
  sessionStorage.removeItem(COACH_HIGHLIGHT_PACKAGES_KEY);
  let highlightIds: string[] = [];
  if (rawHighlight) {
    try {
      const parsed = JSON.parse(rawHighlight) as unknown;
      if (Array.isArray(parsed)) {
        highlightIds = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      highlightIds = scrollToId ? [scrollToId] : [];
    }
  }
  return { scrollToId, highlightIds };
}
