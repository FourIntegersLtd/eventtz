import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

/**
 * The tiers of `AGENTS.md`'s repo map, enforced rather than documented.
 *
 * Ported from OSCE `platform-web`'s boundaries config. `app` composes
 * everything; `surfaces` will hold the client/vendor/admin portal shells
 * (workstreams 14-17); `domains` hold one product area's pages and logic;
 * `capabilities` are reusable pieces that must not know which domain
 * mounted them; `foundation` is the floor everything else may use.
 */
export default defineConfig([
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "node_modules/**"]),
  ...next,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*.{ts,tsx}"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "middleware", pattern: "src/middleware.ts" },
        { type: "surface", mode: "full", pattern: "src/surfaces/*/**", capture: ["name"] },
        { type: "domain", mode: "full", pattern: "src/domains/*/**", capture: ["name"] },
        { type: "capability", mode: "full", pattern: "src/capabilities/*/**", capture: ["name"] },
        { type: "foundation", mode: "full", pattern: "src/foundation/*/**", capture: ["module"] },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "off",
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message: "${file.type} may not import ${dependency.type} — see AGENTS.md's repo map.",
          rules: [
            // Routes compose everything and hold no logic of their own.
            { from: ["app"], allow: ["surface", "domain", "capability", "foundation"] },
            // Middleware only answers redirects/CSP, so it reads the foundation only.
            { from: ["middleware"], allow: ["foundation"] },
            // A surface mounts domains and capabilities.
            { from: ["surface"], allow: ["domain", "capability", "foundation"] },
            // A domain may use capabilities, the foundation, and itself.
            {
              from: ["domain"],
              allow: [["domain", { name: "${from.name}" }], "capability", "foundation"],
            },
            // A capability knows nothing about a domain or surface.
            {
              from: ["capability"],
              allow: ["capability", "foundation"],
              message:
                "A capability may not import a ${dependency.type}. Capabilities mount on any surface; take what you need through props.",
            },
            // The floor.
            { from: ["foundation"], allow: ["foundation"] },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/foundation/platform-client",
              /*
               * The request function itself, not the whole module: a page
               * calling `login` and a component reading `hasCode` off an
               * error are both fine. Requests belong in an `api.ts`.
               */
              importNames: ["platformRequest", "setPlatformTokenSource"],
              message:
                "Requests belong in an api.ts, not in a component. Export a named function from your tier's api.ts and call that.",
            },
          ],
        },
      ],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Where talking to the backend is the job.
    files: ["src/**/api.ts", "src/**/api/**/*.ts", "src/foundation/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Generated from the API's OpenAPI document. Never edited by hand.
    files: ["src/foundation/platform-client/schema.d.ts"],
    rules: { "max-lines": "off" },
  },
  {
    // Route files are composition, and barrels are lists.
    files: ["src/app/**/{page,layout,route,template,error,loading,not-found}.tsx", "src/**/index.ts"],
    rules: { "max-lines": "off" },
  },
]);
