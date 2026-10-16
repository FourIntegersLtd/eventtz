# ui-parity 02 fix-up: vendor onboarding wizard bugs + duplicated helpers

First read `.qwen/next20/rules-web.md` (still applies). Mainline is at `75e2308`
("web: vendor onboarding wizard copied from the baseline (ui-parity 02)"). This
fixes review findings from that commit; it does not add scope.

## Fix, most important first

1. **`web/src/domains/vendor-onboarding/steps/StepPricing.tsx:86-104`** — the
   8s "coach applied" highlight timer is nested inside a `setTimeout(…, 0)`,
   and cleanup only clears the outer timer, not the inner one. Failing case:
   apply coach suggestions, then apply again within 8s — the first timer still
   fires and clears the second highlight early, and can call `setState` after
   unmount. Match the baseline (`frontend/.../StepPricing.tsx:84-99`): one
   timer, cleared on cleanup and before starting a new one.

2. **Upload timeouts and network-error messaging**
   (`web/src/domains/vendor-onboarding/api.ts:118-131`,
   `apiErrors.ts:33-37`). The baseline (`frontend/lib/mediaApi.ts`) used a
   120s timeout for image uploads and 180s for file uploads; `web/`'s calls
   have no timeout, so a stalled connection spins forever. Add the same
   timeouts on platform-client's request options. Also restore the baseline's
   `isAxiosNetworkError` branch: a genuine network failure (offline) should
   show "Couldn't reach our servers. Check your internet connection…", not
   the upload-timeout copy that `apiErrors.ts` now shows for every
   `PlatformTransportError`.

3. **Duplicated helpers** (the prompt said "reuse or move logic… rather than
   duplicating it" — these were duplicated instead, and have already drifted
   from their originals):
   - `vendor-onboarding/markets.ts`, `packagePricing.ts`,
     `vendorDiscountDisplay.ts`, `browseLabels.ts`, `vendorPortfolioImages.ts`
     duplicate `domains/marketplace/*` (22/35/135/65/12 differing lines) —
     move the real implementation to `foundation/` (cross-domain imports are
     banned) and have both `vendor-onboarding` and `marketplace` import it.
     Keep whichever tests currently exist; do not drop coverage.
   - `vendor-onboarding/vendorAccess.ts` duplicates
     `vendor-shell/vendorAccess.ts` — same move.
   - `vendor-onboarding/api.ts`'s `fetchVendorProfile` duplicates
     `vendor-shell/api.ts:12` — call the existing one instead of redefining it.

4. **Request body field names vs the baseline** — these work today because
   `api/`'s schemas alias both names, but they're drift, not a copy:
   - `api.ts:52-60` sends `status`; the baseline sends `onboarding_status`
     (`api/app/features/vendors/schemas.py` accepts both via
     `populate_by_name`). Send the baseline's field name.
   - `api.ts:52-60` also silently drops any status other than
     draft/submitted/complete instead of sending it through (the baseline
     lets the server 422 on a bad value). Don't swallow it client-side.
   - `api.ts:109-116` sends copilot review-packages as `{payload}`; the
     baseline sends `{profile_form_data}` (`api/app/features/copilot/schemas.py:112`
     has a `payload` alias, so this also happens to work). Send the
     baseline's field name.

5. **`useOnboardingSteps.ts:83-90` and `useOnboardingPersistence.ts:134-136`**
   — the baseline runs its step guard (`setStep(9)`/`setStep(8)` +
   `setReturnToReview(false)`) inside a `useEffect`; this port calls the
   setters during render instead. It happens to work only because both hooks
   currently run in the same component — if they're ever split, React will
   warn "Cannot update a component while rendering a different component."
   Wrap both in `useEffect` as the baseline does.

6. **Naming/docstrings** (AGENTS.md: no single-letter names, every function
   documented). Docstrings are currently boilerplate one-liners at the top of
   each file only; functions and components inside have none, and
   single-letter names remain, e.g. `k`, `f`, `r` in
   `useOnboardingMedia.ts:70-110`. Fix that file at minimum; sweep the rest of
   `vendor-onboarding/` for the same pattern. Also confirm whether the naming
   guard in `api/tests/guards/` (or an equivalent web lint rule) actually runs
   against `web/` — if it doesn't, say so in your report rather than silently
   leaving it unchecked.

## Not in scope (already correctly left out per the ui-parity 02 report)

Mixpanel events, Photon place autocomplete, the copilot side panel unless the
wizard imports it, portfolio vision analysis (`SKIP_PORTFOLIO_IMAGE_ANALYSIS`).

## Still unverified — do this before reporting done

No signed-in browser walk-through has happened yet for this screen, on either
attempt. Registering a new vendor at `/register?type=vendor` on :3001 (api on
:8001) succeeds and shows "Account created", but the flow requires email
verification and `api/.env` has no `RESEND_API_KEY`, so `ResendMailer` only
logs `email skipped (RESEND_API_KEY not set): <subject>` — no verification
link anywhere to click. Find how this project verifies a local test account
without a real inbox (check `api/scripts/seed_local_admins.py` for a pattern,
or whether the identity repository has a way to mark an account verified
directly), then actually walk the wizard signed in: every step including a
photo upload and the review step, submit, confirm "submitted" status, at
desktop width and 375px, `/vendor/onboarding` redirects, and a
returned-for-edits vendor sees the baseline copy. Report which of these you
checked and which you still couldn't.

## Done

1. `npm run ci` in `web/` exits 0, test count included in the report.
2. The browser walk-through above, actually completed (or say exactly why not).
3. Commit only the fixed paths as
   `web: fix vendor onboarding wizard review findings (ui-parity 02 fixup)`.
4. Report: the commit, test count, each fix confirmed against the baseline
   file/line, the browser steps checked, and anything still left out with the
   reason.
