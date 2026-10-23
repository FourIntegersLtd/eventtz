import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AREA_COMPOSES,
  COMPONENT_FEATURE_ALLOW_LIST,
  SHARED_FEATURE_MODULES,
} from "../eslint.boundaries.mjs";

/**
 * Keeps the exception lists in `eslint.boundaries.mjs` honest: every entry must still exist and still
 * be needed, and the README table must name exactly the shared modules, so a list cannot rot into a
 * silent hole in the boundary.
 */
const webRoot = path.resolve(__dirname, "..");
const featuresRoot = path.join(webRoot, "features");

/** Every .ts/.tsx file under `dir`, as a path relative to `webRoot`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [path.relative(webRoot, full)] : [];
  });
}

/** Quoted module specifiers in a file's `from "..."` and `import("...")` forms. */
function specifiersOf(file: string): string[] {
  const source = readFileSync(path.join(webRoot, file), "utf8");
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map((match) => match[1]);
}

/** The features/-relative target of an import (`bookings/bookingTerms`), or null when it is not a feature import. */
function featureTarget(specifier: string, importingFile: string): string | null {
  if (specifier.startsWith("@/features/")) return specifier.slice("@/features/".length);
  if (!specifier.startsWith(".")) return null;
  const resolved = path.relative(featuresRoot, path.resolve(webRoot, path.dirname(importingFile), specifier));
  return resolved.startsWith("..") ? null : resolved.split(path.sep).join("/");
}

const areaOf = (relativeFile: string) => relativeFile.split("/")[1];
const featureFiles = sourceFiles(featuresRoot);

/** Does a module path (`area/file` or `area/dir`) exist as a file or folder under features/? */
function moduleExists(modulePath: string): boolean {
  const base = path.join(featuresRoot, modulePath);
  return [".ts", ".tsx"].some((extension) => existsSync(base + extension)) || (existsSync(base) && statSync(base).isDirectory());
}

/** Feature files in `fromAreas` that import `modulePath` (or something under it). */
function importersOf(modulePath: string, fromAreas: (area: string) => boolean): string[] {
  return featureFiles.filter(
    (file) =>
      fromAreas(areaOf(file)) &&
      specifiersOf(file).some((specifier) => {
        const target = featureTarget(specifier, file);
        return target !== null && (target === modulePath || target.startsWith(`${modulePath}/`));
      }),
  );
}

describe("eslint.boundaries.mjs lists", () => {
  it("names only shared feature modules that exist and are imported by another area", () => {
    for (const modulePath of SHARED_FEATURE_MODULES) {
      expect(moduleExists(modulePath), `${modulePath} does not exist`).toBe(true);
      const ownArea = modulePath.split("/")[0];
      expect(importersOf(modulePath, (area) => area !== ownArea), `${modulePath} is not imported by another area: remove it`).not.toHaveLength(0);
    }
  });

  it("shares named sub-paths only, never a whole area", () => {
    for (const modulePath of SHARED_FEATURE_MODULES) expect(modulePath, modulePath).toContain("/");
  });

  it("names only composed modules that exist and are imported by the composing area", () => {
    for (const [area, targets] of Object.entries(AREA_COMPOSES)) {
      for (const target of targets) {
        expect(moduleExists(target), `${target} does not exist`).toBe(true);
        expect(importersOf(target, (importerArea) => importerArea === area), `${area} no longer imports ${target}: remove it`).not.toHaveLength(0);
      }
    }
  });

  it("lists only components/ files that exist and still import features/", () => {
    for (const file of COMPONENT_FEATURE_ALLOW_LIST) {
      expect(existsSync(path.join(webRoot, file)), `${file} does not exist`).toBe(true);
      const importsFeature = specifiersOf(file).some((specifier) => featureTarget(specifier, file) !== null);
      expect(importsFeature, `${file} no longer imports features/: remove it`).toBe(true);
    }
  });

  it("has a components/README.md shared-modules table equal to SHARED_FEATURE_MODULES", () => {
    const readme = readFileSync(path.join(webRoot, "components/README.md"), "utf8");
    const tableModules = [...readme.matchAll(/^\| `features\/([^`]+)` \|/gm)].flatMap((row) => {
      const braces = row[1].match(/^(.*)\/\{(.*)\}$/);
      return braces ? braces[2].split(",").map((name) => `${braces[1]}/${name}`) : [row[1]];
    });
    expect([...tableModules].sort()).toEqual([...SHARED_FEATURE_MODULES].sort());
  });
});
