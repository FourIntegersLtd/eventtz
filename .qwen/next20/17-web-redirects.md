# Piece 17 — web: port the baseline redirects and the `/videos` cache header

First read `.qwen/next20/rules-web.md` and follow it in full.
Depends on piece 04 (the admin portal merged), because several redirects target `/admin/*` pages.

## Facts
- `web/next.config.ts` has only two redirects today:
  - `/client/help/messages` → `/client/help`
  - `/vendor/help/messages` → `/vendor/help`

  Its `headers()` sets nosniff, X-Frame-Options and Referrer-Policy on `/(.*)`.
- Baseline `frontend/next.config.ts`: 26 `source:` entries in total. One is the `/api/v1/:path*` rewrite (web has its own; **don't copy it**), and the rest are redirects plus headers. It starts with `/admin/reset-password` → `/reset-password?portal=admin` and `/admin/forgot-password` → ….

## Tasks
1. Read `frontend/next.config.ts` in full. Copy **every** entry in its `redirects()` into `web/next.config.ts`'s `redirects()`, unchanged: same `source`, `destination`, `permanent` and `has`/`missing` conditions. Keep the two existing web redirects.
   - For each one, check that the destination exists in web: `ls web/src/app/...` for the page, or a route group. If a destination page doesn't exist in web yet, **still add the redirect** (the baseline has it; the page may come later), and list it in the report under "redirects to pages web doesn't serve yet".
   - If a redirect's *source* is a path web already serves as a real page, that's a conflict: Next.js applies redirects before pages. Don't add it; list it in the report so I can decide.
2. Copy the `/videos/:path*` `Cache-Control` header entry from the baseline `headers()` into web's `headers()`, as a **separate** entry after the existing `/(.*)` one. Also check whether `web/public/videos/` exists; the header is harmless if it doesn't, so just report that.
3. Move the redirect list into a pure module so it can be tested: `web/src/foundation/routing/redirects.ts` exports `REDIRECTS: Redirect[]` (use Next's type, `import type { Redirect } from "next/dist/lib/load-custom-routes"`; if that import breaks the build, declare a minimal local type). `next.config.ts` imports it.
   - Check first that `next.config.ts` can import from `src/` in this project. If it can't, keep the array in `next.config.ts` and skip the test.
4. `web/src/foundation/routing/redirects.test.ts`:
   - no duplicate sources;
   - every destination starts with `/`;
   - 3 literal spot checks (the admin reset-password one, one client and one vendor) with their exact destination and `permanent` value.

## Allowed paths
`web/next.config.ts` and `web/src/foundation/routing/**`

## Browser/curl check
With `npm run dev` (:3001), run `curl -sI http://localhost:3001/admin/forgot-password` and 3 other sources. Check the status (307/308) and `location` match the baseline's, e.g. `curl -sI http://localhost:3000/...` if the baseline frontend is up. Otherwise compare against the config.

## Commit
`web: port baseline redirects and videos cache header (ws18)`
