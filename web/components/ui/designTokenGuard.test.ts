import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: feature code takes colour from the design tokens (`--ez-*` in
 * design/canvas/project/eventtz.css, Tailwind token classes, `TONE`), never from its own palette.
 * `motion/react` is guarded separately by the no-restricted-imports rule in eslint.boundaries.mjs.
 */
const webRoot = path.resolve(__dirname, "../..");

/** Hex colour literal (#abc, #abcd, #aabbcc, #aabbccdd), not part of a word, URL or entity. */
export const HEX_COLOUR = /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
/** Tailwind violet/purple palette utilities: brand purple is `primary`, `primary-soft`, ... */
export const OFF_BRAND_PURPLE = /(?<![\w-])(?:[a-z-]+:)*[a-z]+-(?:violet|purple)-\d{2,3}\b/;

/** Lines of `source` that break a rule, as `{ line, rule }`. */
export function findTokenViolations(source: string): { line: number; rule: "hex" | "purple" }[] {
  const violations: { line: number; rule: "hex" | "purple" }[] = [];
  source.split("\n").forEach((text, index) => {
    if (HEX_COLOUR.test(text)) violations.push({ line: index + 1, rule: "hex" });
    if (OFF_BRAND_PURPLE.test(text)) violations.push({ line: index + 1, rule: "purple" });
  });
  return violations;
}

function featureSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return featureSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("design token guard", () => {
  it("keeps hex colours and violet/purple palette classes out of features/", () => {
    const offenders = featureSourceFiles(path.join(webRoot, "features")).flatMap((file) =>
      findTokenViolations(readFileSync(file, "utf8")).map(
        (violation) => `${path.relative(webRoot, file)}:${violation.line} (${violation.rule})`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("catches each pattern (meta-test)", () => {
    const rulesFor = (source: string) => findTokenViolations(source).map((violation) => violation.rule);
    expect(rulesFor('<p className="text-[#3e1964]">')).toEqual(["hex"]);
    expect(rulesFor('style={{ color: "#fff" }}')).toEqual(["hex"]);
    expect(rulesFor('style={{ color: "var(--ez-danger, #b42318)" }}')).toEqual(["hex"]);
    expect(rulesFor('const fill = "#aabbccdd";')).toEqual(["hex"]);
    expect(rulesFor('className="bg-violet-100 text-purple-700"')).toEqual(["purple"]);
    expect(rulesFor('className="hover:ring-violet-200"')).toEqual(["purple"]);
  });

  it("leaves tokens, anchors and ordinary copy alone (meta-test)", () => {
    expect(findTokenViolations('<a href="#faq">FAQ</a> <p className="text-primary bg-primary-soft">')).toEqual([]);
    expect(findTokenViolations('style={{ color: "var(--ez-danger)" }} // ticket #12345 &#39;')).toEqual([]);
    expect(findTokenViolations('className="text-accent-violet"')).toEqual([]);
  });
});
