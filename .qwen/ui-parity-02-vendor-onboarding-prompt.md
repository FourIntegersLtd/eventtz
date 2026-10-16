# ui-parity 02: web vendor onboarding wizard on `/vendor/profile`

First read `.qwen/next20/rules-web.md`: it applies in full, including "Screens are copied,
not redrawn". Mainline is at `99e5a0b` (legacy styling base and shared UI).

## Why
In the baseline, `/vendor/profile` *is* the onboarding wizard
(`frontend/app/vendor/(portal)/profile/page.tsx` renders `<VendorOnboarding />`), and
`/vendor/onboarding` redirects there (`frontend/next.config.ts`). In `web/`,
`/vendor/profile` is a rewritten read-only profile (`domains/vendor-profile/ProfileView.tsx`),
so the wizard is missing: new vendors cannot finish sign-up.

## Source (copy all of it)
- `frontend/features/vendor/onboarding/**`: 46 files, about 4,000 lines of TSX. That's
  `VendorOnboarding.tsx`, `OnboardingProgressHeader`, `OnboardingStepContent`,
  `VendorProfilePhotoField`, `VendorProfileSectionTabs`, `steps/Step*.tsx`,
  `form-primitives.tsx`, and the logic files (`onboardingLogic`, `onboardingProgress`,
  `packageQuality`, `packageCoachApply`, `packageExamples`, `serializeVendorPayload`,
  `reviewDisplayHelpers`, `returnedForEditsCopy`, `onboardingCopy`,
  `onboardingStepGuides`, `constants`) **with their `*.test.ts`**.
- `frontend/app/vendor/(portal)/profile/layout.tsx`: the page metadata.
- Anything they import from `frontend/features/vendor/copilot`, `frontend/lib` or
  `frontend/components` that `web/` doesn't have yet. Check `foundation/ui` first; the
  shared UI is already there.

## Where it goes
- `web/src/domains/vendor-onboarding/`: the copied files, same markup and class names.
  Rename single-letter variables and add docstrings, as the rules require.
- `web/src/domains/vendor-onboarding/api.ts`: every call on platform-client with
  generated types. Endpoints (all in `api/openapi.json`):
  - `GET/PUT/PATCH /api/v1/vendor/profile`, and `GET /api/v1/vendor/profile/business-name-available`;
  - `POST /api/v1/media/images`, `POST /api/v1/media/files` (uploads);
  - `POST /api/v1/vendor/onboarding/ai/{generate-bio,review-packages,analyze-portfolio-image}`.

  Use the same method and body the baseline sends. Reuse or move logic from
  `domains/vendor-profile/api.ts` rather than duplicating it.
- `web/src/app/vendor/(portal)/profile/page.tsx` renders the wizard, and `layout.tsx` has
  the baseline metadata.
- Add the `/vendor/onboarding` → `/vendor/profile` redirect in `web/next.config.ts`, as
  the baseline does. If piece 17 (redirects) already added it, leave it.
- **Migrate callers, then delete.** Once the wizard replaces it, delete
  `domains/vendor-profile/ProfileView.tsx`, `PortfolioSection.tsx`, `profileStatus.ts`,
  `serviceCategories.ts` and their tests. The only exception is anything
  `/vendor/profile/reviews` (`ReviewsView`) or another route still imports. Grep before
  deleting.

## Out of scope (list in your report if the baseline has it)
Mixpanel events and Photon address autocomplete/geolocation (keep the plain input the
baseline falls back to). The copilot side panel is out too, unless the wizard imports it
directly; `capabilities/vendor-copilot-panel` already exists, so reuse it.

## Done
1. `npm run ci` in `web/` exits 0. The ported onboarding tests must be in the count.
2. Browser check with `api/` on :8001 and web on :3001, next to the baseline on :3000.
   Sign up as a new vendor and go through every step, including a photo upload and the
   review step, then submit. Confirm the status shows "submitted". Do this at desktop
   width and at 375px. Also check that `/vendor/onboarding` redirects and that a
   returned-for-edits vendor sees the baseline copy.
3. Commit only your paths as `web: vendor onboarding wizard copied from the baseline (ui-parity 02)`.
4. Report: the commit, the test count, the steps you checked in the browser (and any you
   didn't), and any baseline behaviour you left out, with the reason.
