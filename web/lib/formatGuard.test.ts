import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: money, counts, dates and times are formatted only in `lib/money.ts` and
 * `lib/dateFormat.ts`. A screen that needs a new pattern adds a named option or style there
 * instead of calling `toLocaleString`, `Intl` or `toFixed` on its own.
 */
const webRoot = path.resolve(__dirname, "..");
const FORMATTER_FILES = ["lib/money.ts", "lib/dateFormat.ts"];
const SCANNED_FOLDERS = ["app", "components", "features", "lib"];

type Rule = "locale-format" | "intl-format" | "pound-to-fixed";

/** `x.toLocaleString(`, `toLocaleDateString(` and `toLocaleTimeString(`. */
const LOCALE_FORMAT = /\.toLocale(?:Date|Time)?String\(/;
/** `Intl.NumberFormat` and `Intl.DateTimeFormat`. */
const INTL_FORMAT = /\bIntl\.(?:NumberFormat|DateTimeFormat)\b/;
/** A pound sign followed by an interpolation that calls `toFixed`, e.g. `£${total.toFixed(2)}`. */
const POUND_TO_FIXED = /£\$?\{[^}]*\.toFixed\(/;

/** Lines of `source` that format money or dates by hand, as `{ line, rule }`. */
function findFormatViolations(source: string): { line: number; rule: Rule }[] {
  const violations: { line: number; rule: Rule }[] = [];
  source.split("\n").forEach((text, index) => {
    if (LOCALE_FORMAT.test(text)) violations.push({ line: index + 1, rule: "locale-format" });
    if (INTL_FORMAT.test(text)) violations.push({ line: index + 1, rule: "intl-format" });
    if (POUND_TO_FIXED.test(text)) violations.push({ line: index + 1, rule: "pound-to-fixed" });
  });
  return violations;
}

/** Non-test `.ts` and `.tsx` files under `directory`. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("format guard", () => {
  it("keeps hand-written money and date formatting out of everything but money.ts and dateFormat.ts", () => {
    const offenders = SCANNED_FOLDERS.flatMap((folder) => sourceFiles(path.join(webRoot, folder)))
      .filter((file) => !FORMATTER_FILES.includes(path.relative(webRoot, file)))
      .flatMap((file) =>
        findFormatViolations(readFileSync(file, "utf8")).map(
          (violation) => `${path.relative(webRoot, file)}:${violation.line} (${violation.rule})`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("catches each pattern (meta-test)", () => {
    const rulesFor = (source: string) => findFormatViolations(source).map((violation) => violation.rule);
    expect(rulesFor('return `£${total.toLocaleString("en-GB")}`;')).toEqual(["locale-format"]);
    expect(rulesFor('date.toLocaleDateString("en-GB", { month: "short" });')).toEqual(["locale-format"]);
    expect(rulesFor('date.toLocaleTimeString("en-GB");')).toEqual(["locale-format"]);
    expect(rulesFor('new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })')).toEqual([
      "intl-format",
    ]);
    expect(rulesFor('new Intl.DateTimeFormat("en-GB").format(date)')).toEqual(["intl-format"]);
    expect(rulesFor("const label = `£${price.toFixed(2)}`;")).toEqual(["pound-to-fixed"]);
    expect(rulesFor("<span>£{price.toFixed(2)}</span>")).toEqual(["pound-to-fixed"]);
  });

  it("leaves the shared formatters and plain text alone (meta-test)", () => {
    expect(findFormatViolations('formatGbp(total, { decimals: 2 })')).toEqual([]);
    expect(findFormatViolations('formatDate(date, "dayMonthYear")')).toEqual([]);
    expect(findFormatViolations("Up to £500 off. Rating: {rating.toFixed(1)}")).toEqual([]);
    expect(findFormatViolations("`${percent.toFixed(1)}%`")).toEqual([]);
  });
});
