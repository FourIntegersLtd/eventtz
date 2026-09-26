# vendors

## Purpose
Vendor profiles: the onboarding form (8 steps), business-name ownership, admin moderation (approval,
returning a profile for edits, nudges, listing overrides and listing photos) and the rule for when a vendor
is publicly listed.

## Use cases
- As a **vendor**, I **save my onboarding form step by step** so that I can finish my profile over several visits.
- As a **vendor**, I **check a business name is free** before I commit to it.
- As a **vendor**, I **submit my profile** so that staff can review and approve it.
- As **staff**, I **list, approve, ban or return vendors for edits** so that only good vendors are listed.
- As **staff**, I **nudge vendors** to finish their profile or set up payouts.
- As a **super admin**, I **force a listing visible or hidden** with a recorded reason.
- As **staff**, I **reorder and hide a vendor's listing photos**.

## Invariants
- A business name (normalised: case and spaces) belongs to at most one vendor.
- Moving forward a step checks every finished step; submitting checks all eight.
- Uploaded image URLs are kept only when they are ours and under the vendor's own `users/{id}/` prefix.
- A vendor is listed when approved and payouts are verified, unless a super admin overrides it.
- Listing photo overrides may only use the vendor's own profile photo or portfolio images.
- Every staff action is written to the audit log.
- The Stripe Connect columns (`stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`) are
  written only through `service_payouts.py`, which the payments slice calls.

## Routes
Built (cut 1): `GET/PUT /vendor/profile`, `GET /vendor/profile/business-name-available`,
`GET /admin/vendors`, `PATCH /admin/vendors/{user_id}/approval|unsubmit|listing-override|listing-media`,
`POST /admin/vendors/nudge-profile-complete|nudge-setup-payouts`.
Cut 2: `GET /admin/vendors/{user_id}/insights`, `POST /admin/vendors/{user_id}/restore-stripe-connect`.

Baseline quirks kept on purpose (the freeze tests pin them):
- `GET/PUT /vendor/profile` accept any signed-in account, and a `PUT` turns the caller into a vendor.
- The admin 404 reads "Vendor profile not found" with no full stop; a nudge failure reads "Vendor profile not found." with one.

Not yet like the baseline:
- `GET /vendor/profile` does not refresh the payout flags from Stripe; `GET /vendor/payments/status` and the
  `account.updated` webhook do.
- Emails go out before the request's transaction commits (the Mailer is synchronous); they move to a job after commit.

## Onboarding AI (bio, photo QA, package coach)
New files only (`schemas_ai.py`, `service_ai.py`, `router_ai.py`); the rest of this README's
routes and files are unaffected. Every call goes through the `LanguageModel` port
(`api/app/core/ports.py`), so with no OpenAI key configured every route below fails at
`LanguageModelUnavailable` (503) before any prompt is built — matching the baseline's
`require_openai_client()`-first behaviour byte for byte. Ported from
`backend/app/features/vendors/onboarding_ai.py`.

Routes: `POST /vendor/onboarding/ai/generate-bio`, `POST /vendor/onboarding/ai/analyze-portfolio-image`,
`POST /vendor/onboarding/ai/review-packages`. All three require a signed-in vendor.

Invariants:
- The bio and package-coach calls only ever see a safe subset of `profile_form_data` (business
  name, city, services, existing bio, years' experience, packages, portfolio URLs) — never phone,
  email, or anything not already public on the profile.
- The portfolio photo upload is validated before ever reaching the language model: an empty file
  raises `ImageRequired` (400, "Please choose an image to upload."), and a non-`image/*` content
  type raises `ImageContentTypeInvalid` (400, "Only image uploads are supported.").
- The photo QA call uses the `LanguageModel` port's `image_data_url` parameter (a `data:` URL),
  a small additive extension to the port and its fake for this one vision-input call; every other
  caller in the codebase leaves it `None` and gets a plain chat completion.
