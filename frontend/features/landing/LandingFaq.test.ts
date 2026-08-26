import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const landingFaqSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "LandingFaq.tsx"),
  "utf8",
);

describe("LandingFaq", () => {
  it("imports WAITLIST_URL from landingData when the constant is referenced", () => {
    if (!/WAITLIST_URL/.test(landingFaqSource)) return;

    expect(landingFaqSource).toMatch(
      /import\s*\{[^}]*WAITLIST_URL[^}]*\}\s*from\s*["']@\/features\/landing\/landingData["']/,
    );
  });
});
