---
paths:
  - "api/app/features/{vendors,media,copilot}/**"
  - "api/app/adapters/s3_storage.py"
  - "api/tests/**/test_{vendor,vendors_,media_,media,vendor_}*.py"
  - "acceptance/test_{vendor_,media_,ai_onboarding}*.py"
  - "web/app/admin/(portal)/directory/vendors/**"
  - "web/app/vendor/(portal)/{analytics,dashboard,profile}/**"
  - "web/features/vendors/**"
  - "web/features/vendor/{analytics,copilot,dashboard,onboarding,profile}/**"
  - "web/features/admin/vendors/**"
---
# Vendors: what to know

Owner: `vendors-owner` (listing visibility consumers: `marketplace-owner`; Stripe Connect columns: `money-owner`).
Proof: `verify-vendors`. Reviews: `quality-reviewer` always; `reviewer` (opus) when a change touches
visibility, the listing override or pause, deletion, or anything staff-facing that hides a vendor.

- **Never filter public vendors by `approval_status` by hand.** Use `vendors/visibility.py`
  (`apply_public_listing_filters`, `row_is_publicly_listable`, `vendor_payouts_verified`, `payout_gate_waived`).
  Listable = approved AND (Stripe verified OR admin waived) AND not force-hidden. Pending/banned always wins.
- **Listing override** (`vendors.listing_override`: `auto|visible|hidden`, migration 062) needs a reason
  for non-`auto`, written to `admin_audit_logs`. `visible` waives the payout gate for listing, accept and checkout.
  A listing pause (`PUT/DELETE .../listing-pause`) hides via the helpers and never touches `approval_status`.
- **List prices come from `vendors.payload`** (`list_pricing.py`). A complete package has title, price and
  `details` of 40+ chars; incomplete ones are excluded from browse and booking. Never trust a client `unit_price_gbp`.
- **The 8-step onboarding.** Advancing validates the step being completed (`payload_validation.py`); submit
  validates all eight. Portfolio needs 5-20 images; `maxBookingsPerDay` clamps to 1-20. Rules are mirrored in
  `web/features/vendor/onboarding/` (`packageQuality.ts`, `constants.ts`): change both sides together.
- **Business names are unique** (normalised: case and spaces; migration 032), checked by `business-name-available` and the DB.
- **Uploaded URLs** are kept only when ours and under the vendor's own `users/{id}/` prefix; listing photo
  overrides may use only the vendor's own profile or portfolio images. Media keys are `users/<id>/...`, never reused.
- **Insurance** (`domain_insurance.py`, migration 0011) is optional and never blocks submit, approval or listing.
  `insurance_*` columns are staff-written; `insuranceCheckedUntil` is set by the api, never from the vendor form.
- **Terms options** (`deliveryUpfrontPercent` 50-60, `deliveryDeadlineDays` 1-60, `damageDepositGbp` 0-1000)
  are snapshotted at checkout (ADR 0010); `web/lib/policyConstants.json` must equal the api constants.
- **Stripe Connect columns** are written only via `service_payouts.py` (payments slice calls it). Reads never call Stripe,
  except `GET /vendor/profile` with `refresh_payouts=True`. Hiding a listing never clears Connect columns.
- **Reading a stored upload** (e.g. photo QA by URL) goes through `Storage.read_object` with a byte cap, and only for keys under the caller's `users/<id>/` (`own_upload_key`). Services never import `app.adapters` or `httpx` (guard `test_services_are_adapter_free.py`).
- **Copilot / AI:** every model call goes through the `LanguageModel` port; no OpenAI key means 503
  `OPENAI_UNAVAILABLE` (the daily brief falls back to fixed text). The model sees only a safe subset of the profile (no phone or email). Copilot reads other slices only through their `service*` functions.
- Every staff action is audit-logged. Closed accounts are tombstones: never restore one on upsert.
- **Web:** `web/` is the copied old frontend: change a screen only to fix it (`web/UI-CONVENTIONS.md`).
- **Web blocks:** use `Card`/`Banner`/`PageHeader`/`StatTile`/`Badge`/`Button`, never raw `ez-*` or `neutral-*`, `amber/red/emerald/sky-*` (use `text-warning`, `bg-danger-soft`, `border-success-line`). `StatTile` `hint` renders `ez-small`, not `ez-caption`, so a tile with a caption keeps its `ez-kpi` markup. `Card` forwards `data-*`/`id` (the design-diff probes need them). The admin vendors list is `useAdminVendors` over `useServerList`; the bulk selection is keyed to the page and filters and clears when either changes.

## What a failure looks like here
- A public query that lists vendors by `approval_status` (or reimplements the payout gate) instead of the visibility helpers.
- A pause, override or takedown that changes approval or Stripe columns, or hides a vendor without an audit row.
- A price, discount or package option read from request input, or an incomplete package offered to clients.
- Validation changed on one side only (api `payload_validation.py` vs web onboarding validation), so a step saves but fails on submit.
- An image or document URL from outside the vendor's `users/{id}/` prefix stored in the payload.
- An AI route that sends contact details to the model, or breaks the 503/fallback behaviour.
