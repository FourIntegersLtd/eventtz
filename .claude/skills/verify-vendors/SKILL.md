---
name: verify-vendors
description: How to prove a change to vendors works (profile and 8-step onboarding, visibility and listing override, admin vendor review, media uploads, copilot and AI helpers). Use before calling any vendors, media or copilot change done.
---

# Verify vendors

Pick the **lowest level that can see your change**, run it, and report the command and its result.

| Your change | Minimum proof |
|---|---|
| Payload validation, package quality, insurance or consequences domain rule | Level 1 |
| Visibility, listing override or pause, admin vendor routes, repository write | Level 1 with the DB tests actually run (count skips) |
| A route's response shape or error `code`, media upload rules, copilot prompts | Level 1 + Level 2 on that file |
| An onboarding, profile, dashboard or admin vendor screen | Level 1 (web) + Level 3 as vendor and admin |

## Level 1: tests (~10 s, needs Postgres on :5434)

```bash
cd api && make db-up   # skip if `docker ps` shows eventtz-api-postgres-1 on :5434
poetry run python -m pytest -q -rs \
  tests/http/test_vendors_admin_detail.py tests/repository/test_vendor_consequences.py \
  tests/repository/test_vendor_insurance.py tests/golden/test_media_goldens.py \
  tests/golden/test_vendor_email_goldens.py tests/golden/test_vendor_profile_goldens.py \
  tests/unit/test_media_service.py tests/unit/test_vendor_consequences_domain.py \
  tests/unit/test_vendor_insurance_domain.py
make guards            # AST architecture guards (includes ownership)
cd ../web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" \
  && npx vitest run features/vendor/dashboard features/vendor/onboarding lib/imageUploadFile.test.ts \
     lib/vendorAccess.test.ts lib/vendorAvailability.test.ts lib/vendorPortfolioImages.test.ts lib/vendorServiceCatalog.test.ts
```

API: 215 passed, 0 skipped on 2026-10-18 (includes the uncommitted `test_vendors_admin_detail.py`).
Web: 10 files, 49 passed on 2026-10-18. A change to a validation rule needs the matching web test
(`packageQuality.test.ts`, `onboardingProgress.test.ts`) in the same run. Goldens are byte-exact: never update a fixture to pass.
A route or path change also needs `make parity`.

## Level 2: acceptance (frozen baseline behaviour)

```bash
cd acceptance && make serve        # leave running (api on :8001)
make test ARGS="test_vendor_profile.py test_vendor_moderation.py test_media_upload.py test_ai_onboarding.py"
```

`ARGS` goes straight to pytest (add `-k name`). Without an OpenAI key the AI routes answer 503
`OPENAI_UNAVAILABLE` (the daily brief falls back to fixed text): that is expected here.

## Level 3: the running app

`cd api && make dev` (:8001), `cd web && npm run dev` (:3001).
- Vendor: walk onboarding steps 1-8 (a step must refuse bad data on advance and on submit), edit the profile, upload portfolio images, open the dashboard and copilot.
- Admin (`/admin/directory/vendors`): approve, set listing override and pause with a reason, edit listing photos, set insurance.
- Client browse (as a check, marketplace-owner's screen): an approved, verified vendor appears; a paused or hidden one does not.
Then read the stored row: `vendors.approval_status`, `listing_override` and its reason columns, `payload` (image URLs under `users/{id}/`),
`insurance_*`, and `admin_audit_logs` (one row per staff action).

## Traps
- DB tests **skip silently** without Docker: read the `-rs` skip list and the "N skipped" count; zero skipped is the bar.
- Check pytest's **exit code**, not the tail. Use `poetry run python -m pytest`, not `poetry run pytest` (stale shebang).
- Docker hung: create a fresh DB on the compose Postgres and set
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.
- The shell has no Node: export the nvm PATH above. Web has no `ci` script; lint has inherited errors.
- Storage is off locally (no AWS keys): uploads answer 503, so Level 3 upload checks need keys or are not proven; say which.
- Unit tests only exist for some vendor modules; the `tests/http/test_vendor*.py` glob in OWNERS.md currently matches only the admin detail test, so profile routes are proven by Level 2.
- Screen work (web only): run `scripts/design-diff/run.mjs` per screen id on a branch dev server and on a `main` worktree, one run at a time (each re-seeds the vendor and sign-in is rate limited, so flush Redis between screens). A `TimeoutError` or a "Loading..." screenshot is the dev server or browser, not the change: rerun that id. Compare status, percentage and geometry lines against main, not the budget. If Playwright's browsers vanished, `npx playwright install chromium`.
