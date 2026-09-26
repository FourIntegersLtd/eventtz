# web

The rebuilt Eventtz frontend (Next.js 16 + React 19), replacing `frontend/`
in place, one route group at a time. Serves the same URLs as the baseline.
See the repo-root `AGENTS.md` for the overall rebuild plan and boundaries.

## Layout

```
src/app/            Routes only (App Router). URLs are public contracts.
src/surfaces/       Cross-domain page shells (not yet used by this slice).
src/domains/        One product area each: auth, marketing. A domain may
                     import itself, capabilities and foundation — never
                     another domain (enforced by eslint-plugin-boundaries).
src/capabilities/   Shared, domain-agnostic building blocks.
src/foundation/      platform-client (fetch wrapper, session/token
                     lifecycle, generated API types), session (SessionProvider,
                     can()), ui (Button, Card, TextField, Spinner...),
                     monitoring (Sentry/Mixpanel stubs, off when unconfigured).
```

## Commands

```bash
npm run dev       # next dev :3001 (baseline frontend keeps :3000)
npm run build     # production build
npm run types     # tsc --noEmit
npm run lint      # eslint .
npm run test      # node --test, over src/**/*.test.ts
npm run api:types # regenerate foundation/platform-client/schema.d.ts from ../api/openapi.json
npm run ci        # types + lint + test + build, in that order
```

Copy `.env.example` to `.env.local` and fill in values for your machine.
`NEXT_PUBLIC_PLATFORM_API_URL` / `PLATFORM_API_URL` default to the local
`api/` on `:8001` when unset. Sentry and Mixpanel are off (no requests, no
SDK init) when their env vars are empty.

## Session model

The platform API issues a bare access/refresh token pair. `web` wraps that in
its own `httpOnly` cookies on its own origin, set by the Route Handlers under
`src/app/api/session/`; the refresh token never reaches client-side
JavaScript. The access token is cached in memory
(`foundation/platform-client/auth.ts`) and refreshed shortly before it
expires, with `navigator.locks` serialising the refresh across tabs so two
tabs never spend the same single-use refresh token at once. See the doc
comments in `foundation/platform-client/{auth,sessionCookies}.ts` for the
full reasoning.

## Testing

`npm run test` runs Node's built-in test runner via a custom ESM loader
(`scripts/test-loader.mjs`) that resolves the `@/` path alias and strips
TypeScript, so tests import the same modules the app does. Tests assert
literal expected values (AGENTS.md's "test behaviour, not implementation"),
mocking `fetch` rather than reaching the network.
