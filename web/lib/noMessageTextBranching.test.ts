/**
 * ADR 0004: the frontend branches on the API error `code` (`getApiErrorCode`) or an error type,
 * never on message text. This fails if a feature, lib or component file compares or pattern-matches a
 * `detail` / `message` / `msg` value (`detail === ...`, `/re/.test(message)`, `msg.includes(...)`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCANNED_ROOTS = ["features", "lib", "components"].map((folder) => path.join(WEB_ROOT, folder));

/** Files allowed to match, each with the reason. */
const ALLOWED_FILES = new Set([
  // Filters Sentry events by browser-generated message; no API error is involved.
  "lib/sentryConfig.ts",
]);

const TEXT_VARIABLE = String.raw`(?:\w+\.)*(?:detail|message|msg)(?:\.(?:toLowerCase|trim)\(\))*`;
const MESSAGE_TEXT_BRANCH = new RegExp(
  [
    String.raw`\b${TEXT_VARIABLE}\s*[!=]==?\s`,
    String.raw`[!=]==?\s*${TEXT_VARIABLE}\b(?![!?]?[.(\[\w])`,
    String.raw`\b${TEXT_VARIABLE}\.(?:includes|startsWith|endsWith|match)\(`,
    String.raw`\.test\(\s*${TEXT_VARIABLE}\s*\)`,
  ].join("|"),
);

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const absolute = path.join(folder, entry);
    if (statSync(absolute).isDirectory()) return sourceFiles(absolute);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [absolute] : [];
  });
}

/** Lines that branch on message text instead of an error code. */
export function messageTextBranchLines(file: string, source: string): string[] {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => !line.trim().startsWith("//") && MESSAGE_TEXT_BRANCH.test(line))
    .map(({ number, line }) => `${file}:${number}: ${line.trim()}`);
}

describe("no branching on error message text", () => {
  it("finds none in web/features or web/lib", () => {
    const offenders = SCANNED_ROOTS.flatMap(sourceFiles)
      .map((absolute) => path.relative(WEB_ROOT, absolute).replaceAll("\\", "/"))
      .filter((file) => !ALLOWED_FILES.has(file))
      .flatMap((file) => messageTextBranchLines(file, readFileSync(path.join(WEB_ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("flags the patterns that caused the bug and passes code branching", () => {
    const flagged = [
      "if (/verify your email/i.test(detail)) {",
      "reason: detail === SESSION_VERIFY_FAILED ? 'a' : 'b',",
      'e instanceof Error && e.message === "Please sign in again"',
      'if (msg.toLowerCase().includes("payout setup")) {',
      "if (SOME_TEXT === err.message) {",
    ];
    const passed = [
      'if (getApiErrorCode(err) === "email_not_verified") {',
      "const message = getApiErrorDetail(err) ?? fallback;",
      "if (message) setError(message);",
      "const text = isMessage === undefined ? a : b;",
    ];
    expect(flagged.filter((line) => messageTextBranchLines("x.ts", line).length === 0)).toEqual([]);
    expect(passed.filter((line) => messageTextBranchLines("x.ts", line).length > 0)).toEqual([]);
  });
});
