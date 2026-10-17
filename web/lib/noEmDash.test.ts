/**
 * House style: user-facing copy never uses an em dash. Scans every source line in the app,
 * minus comments, and fails on one. `lib/validation/money.ts` is allowed: its regex detects
 * dashes a vendor typed rather than showing one.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCANNED_FOLDERS = ["app", "components", "features", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".json"]);
const ALLOWED_FILES = new Set(["lib/validation/money.ts", "lib/noEmDash.test.ts"]);
const EM_DASH = "—";

/** Every source file under `folder`, relative to `web/`. */
function sourceFiles(folder: string): string[] {
  return readdirSync(path.join(WEB_ROOT, folder)).flatMap((entry) => {
    const relative = path.join(folder, entry);
    if (statSync(path.join(WEB_ROOT, relative)).isDirectory()) return sourceFiles(relative);
    return SOURCE_EXTENSIONS.has(path.extname(entry)) ? [relative] : [];
  });
}

/** `file:line` for each non-comment line in `source` that contains an em dash. */
export function emDashLines(file: string, source: string): string[] {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ""),
  );
  return withoutBlockComments
    .split("\n")
    .map((line, index) => ({ line: line.replace(/(^|\s)\/\/.*$/, ""), number: index + 1 }))
    .filter(({ line }) => line.includes(EM_DASH))
    .map(({ number }) => `${file}:${number}`);
}

describe("no em dash in copy", () => {
  it("finds none in app, components, features or lib", () => {
    const offenders = SCANNED_FOLDERS.flatMap(sourceFiles)
      .filter((file) => !ALLOWED_FILES.has(file))
      .flatMap((file) => emDashLines(file, readFileSync(path.join(WEB_ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("would catch one in a string but not in a comment", () => {
    const source = `// a ${EM_DASH} b\n/* c ${EM_DASH} d */\nconst tip = "Add a photo ${EM_DASH} now";\n{/* e ${EM_DASH} f */}`;
    expect(emDashLines("copy.ts", source)).toEqual(["copy.ts:3"]);
  });
});
