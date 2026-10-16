Task: ws14 client portal, piece 2 (review follow-ups on the shell and contact page).
Work directly on branch `rebuild/osce-architecture` in THIS folder
(/Users/yahayakenny/Documents/Projects/eventtz). Your piece 1 (a258461 + edbfe6c) is
already merged there, together with the vendor portal. ALL ws14 work goes on this
branch: never create, switch or check out another branch, never make a worktree, and
never push.

## Context
Eventtz is being rebuilt: web/ (new Next.js app) replaces frontend/ (the live baseline).
frontend/ and backend/ are reference only. NEVER edit them, and never edit api/.
Read first: AGENTS.md, web/AGENTS.md, web/README.md. web/AGENTS.md says this Next.js
version differs from your training data: check node_modules/next/dist/docs before using
an API you're unsure of.
Tiers import downwards only: app → domains → capabilities → foundation.

## Scope (only these three things)
1. One shared portal shell. web/src/domains/client-shell/PortalShell.tsx and
   web/src/domains/vendor-shell/PortalShell.tsx are near-identical copies (they differ
   only in names and which nav helpers they call). Replace them with one shared shell
   that each portal configures with its own nav items, title rules and mobile rules.
   Decide where it lives so the tier rules and the ESLint boundaries config allow both
   domains to use it. Delete the duplicated code; no compatibility wrapper left behind.
   Both portals must look and behave exactly as they do now, including the mobile
   hamburger menu from edbfe6c.
2. Accessibility the baseline has and the port lacks:
   - `aria-current="page"` on the active nav link
     (baseline: frontend/components/portal-shell/PortalShell.tsx:106);
   - `aria-expanded` on the mobile menu button
     (baseline: frontend/components/portal-shell/PortalShell.tsx:353).
3. A test for the client contact page. Tests run under `node --test` on `*.test.ts`
   files only, so JSX can't be imported. Move the page's pure logic (validation,
   building the request body, mapping a PlatformError code to the message shown) into
   a plain .ts module that ContactView uses, and test that module.

## Rules
- Call the API through foundation/platform-client with the generated types. No
  hand-written API types. Don't regenerate schema.d.ts or openapi.json.
- Branch on PlatformError.code only, never on message text.
- No new npm dependencies. If you think you need one, stop and ask.
- Descriptive names (no single letters, even in loops); a short doc comment on every
  module, component and function; comment any non-obvious "why".
- Tests assert behaviour with literal expected values. A test must import concrete
  modules, never a barrel file that re-exports .tsx (that crashes node --test).
- Every file ends with a newline.

## Working method
- Follow ~/.qwen/QWEN.md: this change spans several files and two portals, so get a
  plan from the `planner` subagent first, then implement it here.
- Use the `scout` subagent to read the baseline; use the `worker` subagent to run CI and
  report only failures.
- Before committing, have the `reviewer` subagent review your diff; fix what is real.
- Setup: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && cd web && npm ci

## Done means
1. `cd web && npm run ci` exits 0 (check the exit code).
2. `git status` shows changes only under web/src/domains/client-*, web/src/domains/vendor-shell,
   web/src/app/client/**, web/src/app/vendor/** and the new shared shell's folder.
3. One commit: "web: shared portal shell, nav aria attributes, contact page tests (ws14)".
4. Report of 10 lines or fewer: what you changed, where the shared shell lives and why,
   what the reviewer found and what you fixed, tests added, and `/stats model` output.
5. In the report, list every subagent you used and the model each ran on.
