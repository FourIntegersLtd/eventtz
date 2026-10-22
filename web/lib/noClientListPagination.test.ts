/**
 * Portal list screens paginate and filter on the server. This fails if a feature view
 * slices API rows for table pagination (`.slice(offset` patterns), or applies `.filter(`
 * to a state array that was filled from one fetched page (`setRows(page.bookings)`):
 * page 2, the counts and the total are then wrong once a filter is chosen.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(__dirname, "..");
const SCANNED_ROOT = path.join(WEB_ROOT, "features");
const ALLOWED_FILES = new Set(["lib/noClientListPagination.test.ts"]);

/**
 * `file:stateName` pairs that filter one page on purpose or are known debt. Each needs a reason.
 * Adding a pair is a decision to show page-only numbers; prefer a server filter or aggregate.
 */
const ALLOWED_PAGE_FILTERS = new Map<string, string>([
  [
    "features/admin/vendors/useAdminVendors.ts:rows",
    "bulk-email selection is page-scoped by design (named selectableUserIdsOnPage)",
  ],
  [
    "features/admin/referrals/AdminReferralsView.tsx:partners",
    "DEBT: 'Active creators' KPI counts the current page only; needs a server active_count",
  ],
]);

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

/**
 * Lines that `.filter(` a state array whose setter was fed from a fetched page
 * (`setName(page.x)`, `setName(data.x)`, ...). Filtering other arrays is fine.
 */
export function pageRowFilterLines(file: string, source: string): string[] {
  const pageStateNames = new Set(
    [...source.matchAll(/\bset(\w+)\(\s*(?:page|data|result|response|res|payload)\??\.\w+/g)].map(
      (match) => match[1][0].toLowerCase() + match[1].slice(1),
    ),
  );
  return source
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) =>
      [...pageStateNames].some(
        (name) =>
          new RegExp(`\\b${name}\\s*\\.filter\\s*\\(`).test(line) &&
          !ALLOWED_PAGE_FILTERS.has(`${file}:${name}`),
      ),
    )
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

  it("finds no .filter( on fetched page rows in web/features", () => {
    const offenders = sourceFiles(SCANNED_ROOT)
      .map((absolute) => relativeToWeb(absolute))
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .flatMap((file) => pageRowFilterLines(file, readFileSync(path.join(WEB_ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("flags a chip filter over the page state but not other arrays", () => {
    const source = [
      "const [rows, setRows] = useState([]);",
      "setRows(page.bookings);",
      "const visible = rows.filter((row) => matches(row, chip));",
      "const names = other.filter(Boolean);",
    ].join("\n");
    expect(pageRowFilterLines("x.tsx", source)).toEqual([
      "x.tsx:3: const visible = rows.filter((row) => matches(row, chip));",
    ]);
  });
});
