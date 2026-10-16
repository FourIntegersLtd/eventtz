# Rules for every web/ piece (read once per piece; they apply in full)

## Where you are
Repo /Users/yahayakenny/Documents/Projects/eventtz, branch `rebuild/osce-architecture`. Work directly
on it: never create, switch or check out a branch, never make a worktree, never push, never deploy.
If `git status` shows uncommitted changes under web/ or api/ when you start, stop and say so in one
line. Untracked .claude/, .qwen/, .vscode/, .clineignore, supabase/.branches and supabase/.temp are
expected: never stage them.

Eventtz is a UK events marketplace being rebuilt: web/ (new Next.js app) replaces frontend/ (the live
baseline); api/ replaces backend/. frontend/ and backend/ are the behaviour reference: read them,
NEVER edit them. Don't edit api/ unless the piece says so.
Read first: AGENTS.md, web/AGENTS.md, web/README.md. This Next.js version differs from your training
data: check web/node_modules/next/dist/docs before using an API you're unsure of.
Setup: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`; `npm ci` in web/ only if
web/node_modules is missing.

## Architecture
- Tiers import downwards only: app → surfaces → domains → capabilities → foundation. A domain may
  NOT import another domain (web/eslint.config.mjs). To combine two domains, compose them in the app
  route (pass one in as a prop/child) or move the shared pure logic down to a capability.
- Client pages live under web/src/app/client/(portal)/, vendor under web/src/app/vendor/(portal)/ (or
  as the existing vendor routes do), admin under web/src/app/admin/. Globs and grep break on
  "(portal)": quote paths or use `git ls-files | grep`.
- Where the baseline uses ONE component for two portals (a `role`/`portal` prop), share one domain
  (like domains/messages, domains/help, domains/settings). No copies, no compatibility wrappers.
- Call the API only through foundation/platform-client with the generated types (schema.d.ts). No
  hand-written API types. If an endpoint the baseline calls is missing from schema.d.ts, leave that
  part out and report it. Branch on PlatformError.code only, never on message text.
- **Screens are copied, not redrawn** (ui-parity, `99e5a0b`). The legacy component in frontend/ is the
  source: keep its JSX, class names, copy, icons, animations and responsive behaviour. Change only
  the file's tier, the data source (the domain's `api.ts` on platform-client instead of axios) and
  imports, names and docstrings. web/ has the same styling as frontend/: Tailwind 4, the same
  globals.css, lucide-react, react-icons, motion, Lottie (`public/animations/`), recharts, @dnd-kit,
  TipTap. The legacy shared UI is already in foundation/ui (Button, Modal, Drawer, EmptyState,
  LoadingState, Lottie*, Toast, Tooltip…): import it from there, never copy it again.
- No new npm dependencies beyond those (no Sentry or Mixpanel).
- Derived loading (lint rule react-hooks/set-state-in-effect forbids setState in an effect body):
  store the result with the fetch key it answers (`{ key, data, error }`); `loading =
  result?.key !== currentKey`; the effect only starts the request and calls setState inside
  then/catch; a `cancelled` flag in the cleanup drops stale responses.
- Money: display prices that the api returns. Never send a price the browser computed.

## Style and tests
- `page.tsx` and `layout.tsx` export ONLY their default component (plus Next route config). Put shared components in a sibling file. Extra exports pass a cold `npm run ci` but fail once a dev server has generated `.next/dev/types`.
Descriptive names (no single letters, even in loops). A short doc comment on every module, component
and function; comment any non-obvious "why". Pure logic (validation, view models, request bodies,
formatting, decisions) goes in plain .ts files tested with `node --test` (*.test.ts, literal expected
values). Tests import concrete modules, never a barrel that re-exports .tsx. Where the baseline has a
*.test.ts for that logic, port its cases. Match what the user sees and can do: content, empty,
loading and error states, every action, exact copy, the baseline's URLs and query params.

## Out of scope unless the piece says otherwise (list in your report if the baseline has them)
Mixpanel events, anything needing an unapproved package, Photon address autocomplete/geolocation.

## Working method (credits are limited)
- Read the baseline files and the web files you'll touch in one pass. Don't re-read what you read
  or wrote.
- Write each new file complete once. Quick checks while building: `npm run types`, `npm test`.
  Run `npm run ci` (types + lint + tests + build) once at the end.
- If what you find doesn't match the prompt, take the obvious step toward the stated goal and
  mention it in one line.

## Done means
1. `cd web && npm run ci` exits 0 (check the exit code).
2. `git status` shows changes only under the paths the piece allows.
3. Every file ends with a newline. After `git add <your paths>`, run once:
   `git diff --cached --name-only --diff-filter=AM | while read f; do [ -n "$(tail -c1 "$f")" ] && echo >> "$f"; done; git add -u web`
4. If api :8001 and web :3001 are running (`cd web && npm run dev`), open the pages you built and
   say what you saw. Local test logins are @example.com accounts only.
5. One commit with the piece's message, staging explicit paths, ending with the trailer
   `Co-Authored-By: Cursor Agent <noreply@cursor.com>`.
6. Report in 12 lines or fewer: commit hash, pages/components built, exact `node --test` counts
   (# tests / # pass), anything from the baseline left out and why.
