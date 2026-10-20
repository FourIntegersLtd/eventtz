/**
 * Portal list screens paginate on the server. This fails if a feature view slices
 * API rows for table pagination (`.slice(offset` patterns).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCANNED_ROOT = path.join(WEB_ROOT, "features");
const ALLOWED_FILES = new Set(["lib/noClientListPagination.test.ts"]);

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const absolute = path.join(folder, entry);
    if (statSync(absolute).isDirectory()) return sourceFiles(absolute);
    return entry.endsWith(".tsx") || entry.endsWith(".ts") ? [absolute] : [];
  });
}

function relativeToWeb(absolute: string): string {
  return path.relative(WEB_ROOT, absolute).replaceAll("\\", "/");
}

/** Lines that client-paginate list rows instead of using API offset/limit. */
export function clientPaginationLines(file: string, source: string): string[] {
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /\.slice\s*\(\s*\w*Offset/i.test(line))
    .map(({ number, line }) => `${file}:${number}: ${line.trim()}`);
}

describe("no client list pagination in portal features", () => {
  it("finds no .slice(*Offset in web/features", () => {
    const offenders = sourceFiles(SCANNED_ROOT)
      .map((absolute) => relativeToWeb(absolute))
      .filter((file) => !ALLOWED_FILES.has(file))
      .flatMap((file) =>
        clientPaginationLines(file, readFileSync(path.join(WEB_ROOT, file), "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
