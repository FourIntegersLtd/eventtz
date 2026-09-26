# referrals

## Purpose

Two ways people bring business to Eventtz:

- **Creator partners.** Staff add an influencer as a partner with a slug. The partner
  shares `/vendor/register?ref=<slug>`. Vendors who sign up through it are attributed
  to the partner, and staff tick off each shout-out they owe.
- **Vendor client codes.** An approved vendor owns one numeric code (1–6 digits) and
  shares `/client/browse/<vendor>?vref=<code>`. A client who books with it gets money off
  the Eventtz service fee. The discount is tiered by how much they spend with the vendor:
  £10 from £400, £15 from £600.

## Use cases

- As **staff**, I **add a creator partner** so that they get a sign-up link to share
  (`POST /admin/referrals/partners`).
- As **staff**, I **edit or switch off a partner** so that the details stay right and
  old links can stop working (`PATCH /admin/referrals/partners/{id}`).
- As **staff**, I **see the vendors a partner brought in**, filtered by shout-out state
  (`GET /admin/referrals/partners/{id}/signups`), and **mark a shout-out done**
  (`PATCH /admin/referrals/signups/{user_id}`).
- As a **new vendor**, I **see who referred me** on the sign-up page
  (`GET /referrals/partners/{slug}`). My sign-up is credited to that partner
  (`service_partners.attribute_vendor_signup`, called by identity).
- As a **vendor**, I **set my client code once**, either chosen by me or generated, so that I
  can share it (`GET /vendor/referral`, `POST /vendor/referral/code`).
- As a **client**, I **preview what a code saves** before booking
  (`GET /vendors/explore/vendor/{id}/referral-preview`).
- As a **vendor**, I **see the bookings made with my codes** and what they saved my clients
  (`GET /vendor/referral/bookings`).

## Invariants

- A partner's slug never changes after creation, so shared links keep working. New
  slugs are unique: `name`, `name-2`, `name-3`, and so on.
- A vendor's client code never changes once set. Sending the same code again is a
  no-op; any other change is refused (`referral_code_locked`).
- Codes are unique across vendors. The database enforces this, and a lost race becomes
  `referral_code_taken`.
- Only approved vendors have a referral programme. A code only discounts bookings with
  the vendor who owns it, while that code is switched on.
- The discount comes off the service fee only, never the vendor's portion, and is
  capped at the fee. Pricing goes through `pricing.service`.
- After booking, the code stored on the booking is trusted, unless it is proven to belong
  to a different vendor. Paid bookings report the discount stored at payment.
- Attributing a sign-up never raises, and the first partner a vendor came through wins.
- `tests/golden/referrals/` pins slugs, code clean-up, tiers, stored-code discounts
  and client names against the baseline.

## Routes

| Method | Path | Who |
|---|---|---|
| GET | `/referrals/partners/{slug}` | anyone |
| GET, POST | `/admin/referrals/partners` | staff |
| PATCH | `/admin/referrals/partners/{partner_id}` | staff |
| GET | `/admin/referrals/partners/{partner_id}/signups` | staff |
| PATCH | `/admin/referrals/signups/{user_id}` | staff |
| GET | `/vendor/referral` | vendor |
| POST | `/vendor/referral/code` | vendor |
| GET | `/vendor/referral/bookings` | vendor |
| GET | `/vendors/explore/vendor/{vendor_user_id}/referral-preview` | anyone |
