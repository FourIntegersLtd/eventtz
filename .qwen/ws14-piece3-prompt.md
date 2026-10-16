Task: ws14 client portal, piece 3 (notifications, settings, your reviews).
First, piece 2 (shared portal shell). If `git log` has no commit "web: shared portal
shell, nav aria attributes, contact page tests (ws14)", its work is sitting uncommitted
in this working tree. That is expected; do not ask about it. Run `cd web && npm run ci`.
If it exits 0, stage exactly the piece 2 files (web/src/surfaces/, the two
(portal)/layout.tsx files, web/src/domains/client-contact/, the two deleted
*-shell/PortalShell.tsx) and commit them with that message. If it fails, fix only what
piece 2 broke, then commit. Then start piece 3. Work directly on branch
`rebuild/osce-architecture` in THIS folder (/Users/yahayakenny/Documents/Projects/eventtz).
ALL ws14 work goes on this branch: never create, switch or check out another branch,
never make a worktree, and never push.

## Context
Eventtz is being rebuilt: web/ (new Next.js app) replaces frontend/ (the live baseline).
frontend/ and backend/ are reference only. NEVER edit them, and never edit api/.
Read first: AGENTS.md, web/AGENTS.md, web/README.md. web/AGENTS.md says this Next.js
version differs from your training data: check node_modules/next/dist/docs before using
an API you're unsure of.
Tiers import downwards only: app → domains → capabilities → foundation.

The vendor portal already has the same pages. It is your pattern:
- web/src/domains/vendor-notifications (list view, api.ts, formatting + its test)
- web/src/domains/vendor-settings (settings view, api.ts)
The baseline uses ONE shared view for both portals (frontend/features/notifications/
NotificationsPageView.tsx and frontend/features/settings/SettingsView.tsx). Do the same
if the logic is shared: move it down a tier (as piece 2 did for the portal shell) and
have both portals use it, rather than copying the vendor files. Delete what it replaces.

## Scope (only these three pages)
1. /client/notifications
   Baseline: frontend/app/client/(portal)/notifications/page.tsx →
   frontend/features/notifications/NotificationsPageView.tsx, frontend/lib/notificationsFeedApi.ts,
   frontend/lib/clientNotificationsApi.ts.
   API: GET /api/v1/client/notifications/feed, POST .../bookings/mark-all-read,
   POST .../bookings/{notification_id}/mark-read.
2. /client/settings
   Baseline: frontend/app/client/(portal)/settings/page.tsx → frontend/features/settings/
   SettingsView.tsx, frontend/lib/userSettingsApi.ts.
   API: GET and PUT /api/v1/user/contact-settings.
   Leave out the "delete account" section: POST /api/v1/user/account/deletion is not
   built on api/ yet (another workstream). Say so in your report.
3. /client/settings/reviews
   Baseline: frontend/app/client/(portal)/settings/reviews/page.tsx →
   frontend/features/client/reviews/ClientOwnReviewsSection.tsx, frontend/lib/reviewsApi.ts.
   API: GET /api/v1/client/reviews.

Match what the user sees and can do on each page: content, empty state, loading, errors,
and every action (mark read, save settings). Live unread updates over realtime are out of
scope (the api does not publish those events yet); a page refresh must show fresh data.

## Rules
- Call the API through foundation/platform-client with the generated types. No
  hand-written API types. Don't regenerate schema.d.ts or openapi.json.
- Branch on PlatformError.code only, never on message text.
- No new npm dependencies. If you think you need one, stop and ask.
- Descriptive names (no single letters, even in loops); a short doc comment on every
  module, component and function; comment any non-obvious "why".
- Put pure logic (formatting, grouping, form validation, request bodies) in plain .ts
  modules and test those with `node --test` (*.test.ts, literal expected values). Tests
  import concrete modules, never a barrel that re-exports .tsx.
- Every file ends with a newline.

## Working method
- Follow ~/.qwen/QWEN.md: this spans several files and both portals, so get a plan from
  the `planner` subagent first, then implement it here.
- Use the `scout` subagent to read the baseline; use the `worker` subagent to run CI and
  report only failures.
- Before committing, have the `reviewer` subagent review your diff; fix what is real.
- Setup: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH". Run `npm ci` in web/
  only if web/node_modules is missing.

## Done means
1. `cd web && npm run ci` exits 0 (check the exit code).
2. `git status` shows changes only under web/src/app/client/**, web/src/app/vendor/**,
   web/src/domains/client-*, web/src/domains/vendor-notifications,
   web/src/domains/vendor-settings and any shared folder you moved logic into.
3. The vendor notifications and settings pages still work exactly as before.
4. One commit: "web: client notifications, settings and reviews pages (ws14)".
5. Report of 10 lines or fewer: pages built, what you shared with the vendor portal and
   where, anything from the baseline you couldn't match and why, what the reviewer found
   and what you fixed, tests added, and `/stats model` output.
6. In the report, list every subagent you used and the model each ran on.
