#!/usr/bin/env node
/**
 * Design diff: proves a built screen matches its canvas artboard.
 *
 * For each screen in screens.json it renders two documents in headless Chromium at the
 * artboard's size: the artboard itself (its markup plus the shared eventtz.css) and the
 * live Next page. It then reports:
 *   - the pixel mismatch ratio and the most mismatched regions (bounding boxes), so the
 *     fix is located, not just scored;
 *   - geometry probes: for named element pairs, position, size and computed type/colour,
 *     which anti-aliasing cannot fool.
 * Screenshots, the diff image and a JSON report land in web/design/diff-output/.
 * Exit code 1 when any screen is over its mismatch budget or a probe differs, so an
 * agent cannot call a screen done without the numbers.
 *
 * Usage (dev server on :3001 running):
 *   node scripts/design-diff/run.mjs P01-Login            one screen
 *   node scripts/design-diff/run.mjs --all                 every screen in screens.json
 *   node scripts/design-diff/run.mjs P01-Login --base http://localhost:3001
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "../..");
const canvasDir = path.join(webRoot, "design/canvas/project");
const outDir = path.join(webRoot, "design/diff-output");

/** Per-pixel colour tolerance for pixelmatch (YIQ distance, 0 strict to 1 lax). */
const PIXEL_THRESHOLD = 0.2;
/** Share of differing pixels a screen may have before it fails, unless the screen sets its own. */
const DEFAULT_MAX_DIFF_RATIO = 0.005;
/** Grid cell size used to rank mismatched regions. */
const REGION_CELL_PX = 80;
/** How many ranked regions to report. */
const REGIONS_REPORTED = 8;
/** Position or size difference, in CSS px, a geometry probe tolerates. */
const GEOMETRY_TOLERANCE_PX = 2;

/** Reads the command line: screen ids, --all, and --base <url>. */
function parseArguments(argv) {
  const options = { screenIds: [], all: false, base: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--base") {
      options.base = argv[index + 1];
      index += 1;
    } else options.screenIds.push(argument);
  }
  return options;
}

/**
 * Turns an artboard's .dc.html into a plain document: the <x-dc> markup, the <helmet>
 * font link and base style, the shared stylesheet, and uploaded assets (/_blob/<id>)
 * replaced by the local files screens.json maps them to.
 */
function artboardDocument(source, assetMap, baseUrl, unmappedAssets) {
  const helmet = source.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? "";
  const markup = (source.match(/<x-dc>([\s\S]*?)<\/x-dc>/)?.[1] ?? "").replace(
    /<helmet>[\s\S]*?<\/helmet>/,
    "",
  );
  const withAssets = markup.replace(/\/_blob\/([0-9a-f]{32})/g, (whole, assetId) => {
    if (assetMap[assetId]) return baseUrl + assetMap[assetId];
    unmappedAssets.add(assetId);
    return whole;
  });
  const stylesheetHref = path.relative(outDir, path.join(canvasDir, "eventtz.css"));
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><link rel="stylesheet" href="${stylesheetHref}">${helmet}</head><body>${withAssets}</body></html>`;
}

/** Removes the artboard's "Design notes" callout (spec text, never built) and any configured selectors. */
async function stripElements(page, selectors) {
  await page.evaluate((removeSelectors) => {
    for (const callout of document.querySelectorAll(".ez-callout")) {
      const eyebrow = callout.querySelector(".ez-eyebrow");
      if (eyebrow && eyebrow.textContent.trim() === "Design notes") {
        const wrapper = callout.parentElement;
        (wrapper && wrapper.children.length === 1 ? wrapper : callout).remove();
      }
    }
    for (const selector of removeSelectors) {
      for (const element of document.querySelectorAll(selector)) element.remove();
    }
  }, selectors);
}

/** Runs the screen's setup steps on the live page (fill a field, click a control, wait for a selector). */
async function runSetup(page, steps) {
  for (const step of steps) {
    if (step.fill) await page.fill(step.fill, step.value);
    if (step.click) await page.click(step.click);
    if (step.waitFor) await page.waitForSelector(step.waitFor);
  }
}

/**
 * Signs the browser context in through the real login form so screens behind auth can be
 * rendered. Credentials come from screens.json `auth` (a local test account, never a real
 * user) and may be overridden by DESIGN_DIFF_EMAIL and DESIGN_DIFF_PASSWORD.
 */
const signedInStates = new Map();

async function signIn(context, baseUrl, auth) {
  // One sign-in per role per run: later screens reuse the cookies, so many screens in one run stay under the api sign-in rate limit.
  if (signedInStates.has(auth.email)) {
    await context.addCookies(signedInStates.get(auth.email).cookies);
    return;
  }
  const email = process.env.DESIGN_DIFF_EMAIL ?? auth.email;
  const password = process.env.DESIGN_DIFF_PASSWORD ?? auth.password;
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", password);
  await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  await page.close();
  signedInStates.set(auth.email, await context.storageState());
}

/** Waits for fonts and the first paint to settle so both renders are compared at rest. */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** Captures the whole document and returns it as a PNG exactly width x height (cropped or padded white). */
async function screenshotFitted(page, width, height) {
  const raw = PNG.sync.read(await page.screenshot({ fullPage: true }));
  const fitted = new PNG({ width, height });
  fitted.data.fill(255);
  for (let row = 0; row < Math.min(height, raw.height); row += 1) {
    const rowBytes = Math.min(width, raw.width) * 4;
    raw.data.copy(fitted.data, row * width * 4, row * raw.width * 4, row * raw.width * 4 + rowBytes);
  }
  return fitted;
}

/** Measures named elements: position, size and the computed styles that define their look. */
async function measureProbes(page, probes, side) {
  return page.evaluate(
    ({ probeList, sideKey }) =>
      probeList.map((probe) => {
        const element = document.querySelector(probe[sideKey]);
        if (!element) return { name: probe.name, missing: true };
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          name: probe.name,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontFamily: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          color: style.color,
          background: style.backgroundColor,
          padding: style.padding,
          borderRadius: style.borderRadius,
        };
      }),
    { probeList: probes, sideKey: side },
  );
}

/** Compares probe measurements and lists every property that differs beyond tolerance. */
function compareProbes(artboardProbes, pageProbes) {
  const findings = [];
  artboardProbes.forEach((expected, index) => {
    const actual = pageProbes[index];
    if (expected.missing || actual.missing) {
      findings.push({ probe: expected.name, property: "element", expected: expected.missing ? "missing in artboard" : "present", actual: actual.missing ? "missing in page" : "present" });
      return;
    }
    for (const property of Object.keys(expected)) {
      if (property === "name") continue;
      const expectedValue = expected[property];
      const actualValue = actual[property];
      const numeric = typeof expectedValue === "number";
      const differs = numeric ? Math.abs(expectedValue - actualValue) > GEOMETRY_TOLERANCE_PX : expectedValue !== actualValue;
      if (differs) findings.push({ probe: expected.name, property, expected: expectedValue, actual: actualValue });
    }
  });
  return findings;
}

/** Ranks grid cells by mismatched pixel count and returns the worst as bounding boxes. */
function rankRegions(mask, width, height) {
  const columns = Math.ceil(width / REGION_CELL_PX);
  const rows = Math.ceil(height / REGION_CELL_PX);
  const counts = new Uint32Array(columns * rows);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask.data[(y * width + x) * 4 + 3] > 0) {
        counts[Math.floor(y / REGION_CELL_PX) * columns + Math.floor(x / REGION_CELL_PX)] += 1;
      }
    }
  }
  return Array.from(counts, (count, cell) => ({ count, cell }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, REGIONS_REPORTED)
    .map(({ count, cell }) => ({
      x: (cell % columns) * REGION_CELL_PX,
      y: Math.floor(cell / columns) * REGION_CELL_PX,
      width: REGION_CELL_PX,
      height: REGION_CELL_PX,
      mismatchedPixels: count,
      share: Number((count / (REGION_CELL_PX * REGION_CELL_PX)).toFixed(3)),
    }));
}

/** Renders, compares and reports one screen; returns its report. */
async function diffScreen(browser, screen, config, baseUrl) {
  const { width, height } = screen;
  const unmappedAssets = new Set();
  const source = await fs.readFile(path.join(canvasDir, screen.artboard), "utf8");
  const artboardPath = path.join(outDir, `${screen.id}.artboard.html`);
  await fs.writeFile(artboardPath, artboardDocument(source, config.assets, baseUrl, unmappedAssets));

  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const artboardPage = await context.newPage();
  await artboardPage.goto(`file://${artboardPath}`);
  await stripElements(artboardPage, screen.artboardRemove ?? []);
  await settle(artboardPage);
  const artboardShot = await screenshotFitted(artboardPage, width, height);
  const artboardProbes = await measureProbes(artboardPage, screen.probes ?? [], "artboard");

  if (screen.auth) await signIn(context, baseUrl, config.auth[screen.auth]);
  const livePage = await context.newPage();
  await livePage.goto(baseUrl + screen.path, { waitUntil: "load" });
  await runSetup(livePage, screen.setup ?? []);
  await stripElements(livePage, screen.pageRemove ?? []);
  await settle(livePage);
  const liveShot = await screenshotFitted(livePage, width, height);
  const pageProbes = await measureProbes(livePage, screen.probes ?? [], "page");
  await context.close();

  const mask = new PNG({ width, height });
  const mismatched = pixelmatch(artboardShot.data, liveShot.data, mask.data, width, height, { threshold: PIXEL_THRESHOLD, diffMask: true });
  const visualDiff = new PNG({ width, height });
  pixelmatch(artboardShot.data, liveShot.data, visualDiff.data, width, height, { threshold: PIXEL_THRESHOLD });

  await Promise.all([
    fs.writeFile(path.join(outDir, `${screen.id}.artboard.png`), PNG.sync.write(artboardShot)),
    fs.writeFile(path.join(outDir, `${screen.id}.page.png`), PNG.sync.write(liveShot)),
    fs.writeFile(path.join(outDir, `${screen.id}.diff.png`), PNG.sync.write(visualDiff)),
  ]);

  const report = {
    screen: screen.id,
    path: screen.path,
    size: { width, height },
    mismatchRatio: Number((mismatched / (width * height)).toFixed(4)),
    maxDiffRatio: screen.maxDiffRatio ?? DEFAULT_MAX_DIFF_RATIO,
    regions: rankRegions(mask, width, height),
    geometry: compareProbes(artboardProbes, pageProbes),
    unmappedAssets: [...unmappedAssets],
    files: ["artboard.png", "page.png", "diff.png"].map((suffix) => path.join("design/diff-output", `${screen.id}.${suffix}`)),
  };
  report.passed = report.mismatchRatio <= report.maxDiffRatio && report.geometry.length === 0;
  await fs.writeFile(path.join(outDir, `${screen.id}.json`), JSON.stringify(report, null, 2));
  return report;
}

/** Prints one screen's report in a form an agent can act on. */
function printReport(report) {
  console.log(`\n${report.passed ? "PASS" : "FAIL"} ${report.screen} (${report.path})  mismatch ${(report.mismatchRatio * 100).toFixed(2)}% of budget ${(report.maxDiffRatio * 100).toFixed(2)}%`);
  for (const region of report.regions) {
    console.log(`  region x=${region.x} y=${region.y} ${region.width}x${region.height}: ${(region.share * 100).toFixed(0)}% mismatched`);
  }
  for (const finding of report.geometry) {
    console.log(`  geometry ${finding.probe}.${finding.property}: artboard ${finding.expected}, page ${finding.actual}`);
  }
  if (report.unmappedAssets.length) console.log(`  unmapped assets (add to screens.json assets): ${report.unmappedAssets.join(", ")}`);
  console.log(`  images: ${report.files.join("  ")}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = JSON.parse(await fs.readFile(path.join(scriptDir, "screens.json"), "utf8"));
  const baseUrl = options.base ?? config.base;
  const selected = options.all ? config.screens : config.screens.filter((screen) => options.screenIds.includes(screen.id));
  if (selected.length === 0) {
    console.error(`No screen selected. Known ids: ${config.screens.map((screen) => screen.id).join(", ")}`);
    process.exit(2);
  }
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  let allPassed = true;
  try {
    for (const screen of selected) {
      const report = await diffScreen(browser, screen, config, baseUrl);
      printReport(report);
      allPassed = allPassed && report.passed;
    }
  } finally {
    await browser.close();
  }
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message.includes("ERR_CONNECTION_REFUSED") ? `Cannot reach the dev server. Start it with npm run dev. (${error.message})` : error);
  process.exit(2);
});
