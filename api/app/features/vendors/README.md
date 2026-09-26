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

## Routes
Built (cut 1): `GET/PUT /vendor/profile`, `GET /vendor/profile/business-name-available`,
`GET /admin/vendors`, `PATCH /admin/vendors/{user_id}/approval|unsubmit|listing-override|listing-media`,
`POST /admin/vendors/nudge-profile-complete|nudge-setup-payouts`.
Cut 2: `GET /admin/vendors/{user_id}/insights`, `POST /admin/vendors/{user_id}/restore-stripe-connect`.

Baseline quirks kept on purpose (the freeze tests pin them):
- `GET/PUT /vendor/profile` accept any signed-in account, and a `PUT` turns the caller into a vendor.
- The admin 404 reads "Vendor profile not found" with no full stop; a nudge failure reads "Vendor profile not found." with one.

Not yet like the baseline:
- `GET /vendor/profile` does not refresh the payout flags from Stripe; that arrives with the payments slice.
- Emails go out before the request's transaction commits (the Mailer is synchronous); they move to a job after commit.
