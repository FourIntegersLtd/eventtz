import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: screens (`features/`, `app/`) render cards, buttons, badges, banners, page heads and KPI tiles
 * through the `components/ui` blocks, never by writing the canvas `ez-*` class by hand. The rule is
 * stated once, in components/README.md "Design rule". Files that still break it are listed in
 * `ALLOW_LISTED_FILES`; the stale-entry test fails when one stops offending, so the list only shrinks.
 */
const webRoot = path.resolve(__dirname, "../..");

/** A hand-written `ez-btn`, `ez-card`, `ez-badge`, `ez-banner`, `ez-pagehead` or `ez-kpi` class (any modifier). */
const RAW_EZ_CLASS = /(?<![\w-])ez-(?:btn|card|badge|banner|pagehead|kpi)(?![A-Za-z0-9])/;

/** Files under `features/` and `app/` that still use a raw class, to be moved onto the blocks (plan: Phase 2.7 follow-ups). */
const ALLOW_LISTED_FILES: string[] = [
  "features/admin/team/AdminTeamView.tsx",
  "features/admin/vendors/AdminVendorDetailView.tsx",
  "features/admin/vendors/AdminVendorSubmissionActions.tsx",
  "features/admin/vendors/AdminVendorSubmissionChecklist.tsx",
  "features/admin/vendors/AdminVendorSubmissionMediaRail.tsx",
  "features/admin/vendors/VendorMarketplaceStatusBanner.tsx",
  "features/bookings/BookingDateChangeCard.tsx",
  "features/bookings/VendorBookingDetailEzPanel.tsx",
  "features/chat/VendorMessagesEzView.tsx",
  "features/client/planner/BudgetBreakdown.tsx",
  "features/disputes/VendorDisputesEzView.tsx",
  "features/vendor/analytics/VendorAnalyticsEzView.tsx",
  "features/vendor/bookings/VendorBookingDetailExtras.tsx",
  "features/vendor/bookings/VendorBookingResponseFlow.tsx",
  "features/vendor/onboarding/steps/StepPortfolio.tsx",
  "features/vendor/onboarding/steps/submittedScreens.tsx",
  "features/vendor/onboarding/ui/WizardAside.tsx",
  "features/vendor/profile/profileEditorSummaries.ts",
];

/** Lines of `source` that write a raw class, as 1-based line numbers. */
function findRawEzClassLines(source: string): number[] {
  const lines: number[] = [];
  source.split("\n").forEach((text, index) => {
    if (RAW_EZ_CLASS.test(text)) lines.push(index + 1);
  });
  return lines;
}

function screenSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return screenSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

/** Screen files (relative to `web/`, forward slashes) that write a raw class, with their line numbers. */
function offendingFiles(): Map<string, number[]> {
  const offenders = new Map<string, number[]>();
  for (const area of ["features", "app"]) {
    for (const file of screenSourceFiles(path.join(webRoot, area))) {
      const lines = findRawEzClassLines(readFileSync(file, "utf8"));
      if (lines.length > 0) offenders.set(path.relative(webRoot, file).split(path.sep).join("/"), lines);
    }
  }
  return offenders;
}

describe("raw ez-* class guard", () => {
  it("keeps raw ez-btn/card/badge/banner/pagehead/kpi classes out of features/ and app/", () => {
    const unexpected = [...offendingFiles()]
      .filter(([file]) => !ALLOW_LISTED_FILES.includes(file))
      .map(([file, lines]) => `${file}:${lines.join(",")}`);
    expect(unexpected).toEqual([]);
  });

  it("allow-lists only files that still offend (stale entries fail)", () => {
    const offenders = offendingFiles();
    expect(ALLOW_LISTED_FILES.filter((file) => !offenders.has(file))).toEqual([]);
  });

  it("catches a planted offender (meta-test)", () => {
    expect(findRawEzClassLines('<div className="ez-card ez-card--flat">')).toEqual([1]);
    expect(findRawEzClassLines('a\nclassName={`ez-btn ez-btn--sm ${x}`}')).toEqual([2]);
    expect(findRawEzClassLines('<span className="x ez-badge">')).toEqual([1]);
    expect(findRawEzClassLines('<div className="ez-banner--info">')).toEqual([1]);
    expect(findRawEzClassLines('<header className="ez-pagehead">')).toEqual([1]);
    expect(findRawEzClassLines('<div className="ez-kpi__value">')).toEqual([1]);
  });

  it("leaves blocks, other ez-* classes and tokens alone (meta-test)", () => {
    expect(findRawEzClassLines('<Card><Button>Save</Button></Card>')).toEqual([]);
    expect(findRawEzClassLines('<div className="ez-stack ez-progress ez-small">')).toEqual([]);
    expect(findRawEzClassLines('style={{ color: "var(--ez-card-bg)" }} // ez-cardinal')).toEqual([]);
  });
});
