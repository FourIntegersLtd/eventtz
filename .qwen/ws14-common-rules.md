# ws14 client portal: rules for every piece

Read this once at the start of each piece. The piece's own prompt gives the scope.

## Branch
Work directly on branch `rebuild/osce-architecture` in /Users/yahayakenny/Documents/Projects/eventtz.
Never create, switch or check out another branch, never make a worktree, never push.
If `git status` shows uncommitted changes under web/ when you start, a previous piece did
not finish: stop and tell the user in one line. Don't build on them.

## Context
Eventtz is being rebuilt: web/ (new Next.js app) replaces frontend/ (the live baseline).
frontend/ and backend/ are reference only. NEVER edit them, and never edit api/.
Read first: AGENTS.md, web/AGENTS.md, web/README.md. This Next.js version differs from
your training data: check node_modules/next/dist/docs before using an API you're unsure of.
Tiers import downwards only: app → surfaces → domains → capabilities → foundation.
A domain may NOT import another domain (web/eslint.config.mjs). To combine two domains,
compose them in the app route (pass one in as a prop or child), or move the shared pure
logic down to a capability.
Client pages go under web/src/app/client/(portal)/ so they inherit the portal layout's
session and capability gating. Glob/grep patterns break on the "(portal)" folder name:
quote the path or use `git ls-files | grep`.

## Sharing with the vendor portal
Where the baseline uses ONE component for both portals (it takes a `role` or `portal`
prop), do the same: move the vendor domain down to a shared domain named for the feature
(piece 3 did this: domains/vendor-notifications → domains/notifications,
domains/vendor-settings → domains/settings), give it a portal prop, and point both
portals' routes at it. Delete what it replaces. No copies, no compatibility wrappers.
The vendor pages must behave exactly as before.

## Rules
- Call the API through foundation/platform-client with the generated types. No
  hand-written API types. Don't regenerate schema.d.ts or openapi.json. If an endpoint
  the baseline calls is missing from schema.d.ts, leave that part out and report it.
- Branch on PlatformError.code only, never on message text.
- No new npm dependencies (no icon, chart, carousel, Lottie, Sentry or Mixpanel
  packages). Use what web/ already has; if you think you need one, stop and ask.
- Descriptive names (no single letters, even in loops); a short doc comment on every
  module, component and function; comment any non-obvious "why".
- Put pure logic (formatting, grouping, sorting, validation, request bodies, view
  models) in plain .ts modules and test those with `node --test` (*.test.ts, literal
  expected values). Tests import concrete modules, never a barrel that re-exports .tsx.
  Where the baseline has a *.test.ts for that logic, port its cases.
- Match what the user sees and can do: content, empty state, loading, errors, and every
  action. Keep the baseline's URLs and query parameters.
- Every file ends with a newline. write_file drops it, so don't fix files one by one: after
  `git add` of your paths, run once:
  `git diff --cached --name-only --diff-filter=AM | while read f; do [ -n "$(tail -c1 "$f")" ] && echo >> "$f"; done; git add -u web`

## Out of scope for every piece (say so in the report if the baseline has it)
- Live updates: the api does not publish realtime events yet. A page refresh must show
  fresh data. You may wire capabilities/realtime-stream where the vendor twin does.
- Mixpanel events, and anything needing an unapproved package.
- The receipt page and anything calling receipt, payment-record or payout-statement
  endpoints (ws12, not built yet).
- Account deletion (ws13, not built yet).

## Working method
- Follow ~/.qwen/QWEN.md. The piece prompt lists the baseline files: read them yourself
  in ONE turn with parallel reads. Use `scout` only for searches beyond that list.
- If the piece spans several files, get a plan from the `planner` subagent first, then
  implement it here.
- Run CI yourself, once, when the code is written (`npm run ci` in web/); don't re-run it
  after every small edit. Use `npm run types` or `npm test` for a quick check in between.
- Reviewer: only for pieces 7 and 12 (money). For every other piece skip it: Claude reviews
  each commit against the baseline after you finish.
- Aim for under 30 turns. Write each new file complete in one write_file; don't write it
  and then patch it. Don't re-read a file you wrote or already read.
- If what you find doesn't match the prompt (a file moved, an endpoint renamed), take
  the obvious step toward the stated goal and mention it in one line.
- Setup: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH". Run `npm ci` in web/
  only if web/node_modules is missing.

## Done means
1. `cd web && npm run ci` exits 0 (check the exit code).
2. `git status` shows changes only under the paths the piece allows.
3. Existing vendor and client pages still work as before.
4. One commit with the message the piece gives (stage explicit paths; never stage
   .qwen/, .claude/ or supabase/).
5. Report of 10 lines or fewer: pages built, what you shared with the vendor portal and
   where, anything from the baseline you couldn't match and why, what the reviewer found
   and what you fixed, tests added, every subagent used and its model, and
   `/stats model` output.
