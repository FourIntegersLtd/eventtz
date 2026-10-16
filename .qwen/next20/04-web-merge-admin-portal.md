# Piece 04 — web: merge the admin portal branch (ws16) and make CI green

First read `.qwen/next20/rules-web.md` and follow it in full. There is one exception to "never touch
branches": this piece runs **`git merge`** of one existing local branch into the current branch. You
still never check out, create, delete or push a branch.

## Facts, already checked
- The branch is `worktree-agent-a9e91aa9179897ede`, with 4 commits: 48bf480, 0881304, e68ab08 and cf61612. Its merge-base is f030f43.
- It only **adds** files under web/src:
  - 17 pages under `web/src/app/admin/**`;
  - `web/src/capabilities/admin-shell/`: AdminShell, AdminUi, format, nav, permissions, index;
  - 14 `web/src/domains/admin-*` domains.
- `git merge-tree` shows **no conflicts** with the current mainline.
- Mainline has moved 26+ commits since the branch was cut: session, platform-client, portal-shell, the ESLint config and more. Expect type or lint errors from that drift, not merge conflicts.
- Known failure: `capabilities/admin-shell/format.test.ts` expects "26 Sep 2026" and "26 Sep 2026, 10:05", but Node's ICU prints "Sept" for en-GB. `next build` has never been run on this branch.

## Steps
1. Run `git status`; the tree must be clean under web/ and api/. Then run `git merge --no-ff worktree-agent-a9e91aa9179897ede -m "web: merge admin portal (ws16)"`.
2. Fix `web/src/capabilities/admin-shell/format.ts`. The output must not depend on ICU data:
   - Add `const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]`.
   - `formatDate` builds `${getUTCDate()} ${MONTH_SHORT[getUTCMonth()]} ${getUTCFullYear()}`.
   - `formatDateTime` appends `, HH:MM`, zero-padded, in UTC.
   - Keep the "-" placeholder for missing or invalid values.
   - Leave `formatGbp` as it is.
   - Don't loosen the tests. Add cases for 1 Jan (single-digit day), 31 Dec 23:59 and an invalid string.
3. `cd web && npm run ci`. Fix every error the drift causes, in the admin files only, until it exits 0:
   - Types from the regenerated `schema.d.ts`: a field renamed or removed. Check the api schema; don't cast to `any`.
   - Changed foundation exports (`@/foundation/session`, `@/foundation/platform-client`, `@/foundation/ui`). Use today's API.
   - ESLint boundaries. A capability may not import a domain, and a domain may not import another domain.
   - `react-hooks/set-state-in-effect` errors. Leave the existing `queueMicrotask(() => void load())` pattern alone in this piece; piece 05 deals with it.
4. Check that an admin route is guarded. `web/src/app/admin/layout.tsx`, or whatever the branch added, must wrap its pages in `RequireSession` plus an admin capability check (`can(session, "access_admin_portal")`, or whatever `foundation/session/types.ts` names it). A client or vendor must see the capability fallback, not admin data. If the guard is missing, add it the way `web/src/app/vendor/(portal)/layout.tsx` does it.
5. Check that nothing is duplicated. If the branch added its own copy of something mainline now has (a portal shell, a ConfirmDialog), keep the admin one only if the admin UI really differs, and say so in your report.

## Allowed paths
`web/src/app/admin/**`, `web/src/capabilities/admin-shell/**` and `web/src/domains/admin-*/**`, plus the merge itself.
If a foundation file must change for the admin pages to build, stop and report instead.

## Done
`npm run ci` exits 0 with the test count reported. Make one merge commit plus one fix commit, `web: admin portal CI fixes and deterministic date format (ws16)`, with the Cursor trailer.

In the report, list:
- each drift fix, one line each;
- whether the admin layout guard existed;
- the final `node --test` counts.
