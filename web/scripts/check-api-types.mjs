// Fails when web/lib/api-schema.d.ts no longer matches api/openapi.json (ADR 0007).
// Fix: run `npm run api:types` and commit the result.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const committedPath = "lib/api-schema.d.ts";
const scratchDir = mkdtempSync(join(tmpdir(), "api-schema-"));
const regeneratedPath = join(scratchDir, "api-schema.d.ts");
try {
  execFileSync("npx", ["openapi-typescript", "../api/openapi.json", "-o", regeneratedPath], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (readFileSync(committedPath, "utf8") !== readFileSync(regeneratedPath, "utf8")) {
    console.error(`${committedPath} is out of date with api/openapi.json. Run: npm run api:types`);
    process.exit(1);
  }
} finally {
  rmSync(scratchDir, { recursive: true, force: true });
}
console.log("api-schema.d.ts is up to date");
