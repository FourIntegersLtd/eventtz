# Eventtz domain rules

Business invariants that must survive the rebuild. Written before the OSCE-style
slice rebuild (see `docs/adr/0001-feature-slices.md`); file paths below point at the
**pre-rebuild** layout. When a slice is rebuilt, move its section into
`backend/app/features/<slice>/README.md` (Invariants) and delete it here. When this
file is empty, delete it.

### Auth, cookies, deps

- **Cookies:** `app/core/constants.py` - `ACCESS_COOKIE_NAME`, `REFRESH_COOKIE_NAME` (`eventtz_*`).
- **AI models:** `OPENAI_BIO_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_SEARCH_MODEL`, **`OPENAI_HELP_MODEL`** (Help Center assistant), **`OPENAI_PLANNER_MODEL`** (AI Event Planner brief + explanations), **`OPENAI_COPILOT_MODEL`** (Vendor Growth Co-pilot), **`OPENAI_CONTACT_MODEL`** (contact form subject classification).
- **Session:** `features/auth/session.py` - cookie read/write, `get_current_user_or_raise`.
- **Guards:** `features/auth/http/guards.py` - `require_user`, `require_client`, `require_vendor`, `require_admin`.
- **Depends:** `features/auth/http/dependencies.py` - `SupabaseAuthServiceDep`, `get_current_user_dep` when using FastAPI `Depends(...)`.

### Logging

- **`get_logger(__name__)`** after `setup_logging()` in **`main`**.
- **`IS_PRODUCTION=true`**: compact one-line logs.
- **`IS_PRODUCTION=false`**: multi-line “banner” logs. File + stdout under **`backend/logs/`** by default.
- Never log secrets or full auth payloads.

### SQL migrations (`backend/sql/`)

Run in **numeric order** in Supabase (new changes → next `NNN_description.sql`):

| File | Topic |
|------|--------|
| `001_users_and_vendor_onboarding.sql` | Core users + vendor onboarding |
| `002_drop_display_name_from_users.sql` | Schema tweak |
| `003_rename_vendor_onboarding_to_vendors.sql` | `vendors` table |
| `004_vendors_approval_status.sql` | Approval enum |
| `005_allow_banned_vendor_approval_status.sql` | Banned state |
| `006_admin_vendor_list_view.sql` | Admin listing support |
| `009_disable_rls_public_users_vendors.sql` | RLS off for backend-owned tables |
| `010_booking_requests.sql` | Booking requests table |
| `011_booking_completed_and_notifications.sql` | Completed + notifications |
| `012_booking_notification_cancelled.sql` | Cancelled notification |
| `013_booking_paid_at.sql` | Payment timestamp |
| `014_chat_conversations_messages.sql` | Chat |
| `015_booking_vendor_adjustments.sql` | Vendor adjustments JSON |
| `016_booking_notifications_body_and_pricing_kind.sql` | Notification payload |
| `017_booking_reviews.sql` | Reviews |
| `018_admin_console.sql` | Admin-related DB |
| `019_booking_vendor_initiator.sql` | Quote initiator |
| `020_booking_event_postcode.sql` | `event_postcode` |
| `021_dispute_one_active_per_booking.sql` | Dispute constraint |
| `022_dispute_conversation_id.sql` | Dispute + chat link |
| `023_storage_bucket_eventtz_images.sql` | Historical no-op for local stacks; user media is on S3 |
| `024_booking_event_address.sql` | `event_address` |
| `025_ensure_booking_event_postcode_address.sql` | Idempotent postcode+address ensure |
| `026_stripe_connect_payments.sql` | Stripe Connect + payments: `vendors.stripe_*` columns, `booking_requests.payment_status` + payout/completion columns, `stripe_webhook_events` dedupe table, `dispute_cases.resolution_action`/`refund_amount_gbp` |
| `027_message_quote_metadata.sql` | `messages.metadata` jsonb for quote cards / structured chat payloads |
| `028_contact_sharing_preferences.sql` | `users.contact_phone` + `share_email` / `share_phone` / `share_address` |
| `029_seed_vendor_reviews.sql` | Seed / sample reviews (dev/demo) |
| `030_booking_requests_updated_at_index.sql` | Index supporting recent-first booking lists |
| `031_admin_team.sql` | `users.admin_role` (`super_admin` \| `admin`) + team bootstrap |
| `032_vendor_business_name_unique.sql` | Unique vendor business name (+ verify companion `032_verify_…`) |
| `033_booking_daily_capacity.sql` | Concurrency-safe `maxBookingsPerDay` trigger (advisory locks per vendor/day) |
| `034_initial_client_total_label.sql` | Snapshot of client total at request creation (price-update UX) |
| `035_client_preferred_name.sql` | `users.preferred_name` + `users.client_onboarding_completed_at` (client onboarding) |
| `036_booking_cancel_completion.sql` | Cancellation audit (`cancelled_by`/`cancelled_at`) + 48h auto-release/reminder tracking (`payout_auto_released_at`/`completion_reminder_sent_at`), partial index for the maintenance scan, and updated `booking_notifications` kind constraint (adds completion reminder + updated-price kinds) |
| `037_contact_submissions_and_support_hold.sql` | `contact_submissions` table + `booking_requests.support_hold` (pauses auto-release) |
| `074_contact_submissions_admin_portal.sql` | `contact_submissions.portal` also allows `admin` (staff bug reports) |
| `075_job_runs.sql` | `job_runs` unique `(job_name, period_key)` for in-process hourly maintenance lock |
| `076_high_impact_reminders.sql` | `event_tomorrow_reminded_at`, `pay_to_confirm_reminded_at`; `vendors.approved_at`, `payouts_setup_nudge_at`; notification kinds `event_tomorrow` / `vendor_event_tomorrow` / `pay_to_confirm` |
| `077_account_deletion.sql` | `users.deleted_at` tombstone; drop `users` → `auth.users` CASCADE; shared booking/chat/review/dispute/vendor FKs `ON DELETE RESTRICT` |
| `078_payout_held_connect_incomplete.sql` | Notification kind `payout_held_connect_incomplete` when both parties confirmed but Connect cannot receive a Transfer yet |
| `079_help_center_product_gaps.sql` | Help Center: account deletion, receipts, payout hold, reminders, admin report-bug; vendor Account category; related_slug fixes for 068 |
| `080_help_center_ferndesk_tone.sql` | Help Center: Ferndesk-style plain English rewrite of all articles (**74**); NOTE/WARNING callouts; numbered step headings; UPDATE only |
| `081_help_center_callouts.sql` | Help Center: NOTE/WARNING/IMPORTANT callouts on ~28 high-impact articles; UPDATE only |
| `082_help_center_kind_tone.sql` | Help Center: kinder, polite plain-English tone pass on all **74** articles and category descriptions; UPDATE only |
| `038_support_conversations.sql` | Support chat: `conversations.kind` (`dm`\|`support`), `support_user_id`, `admin_last_read_at`, partial unique indexes |
| `039_blog_posts.sql` | `blog_posts` (slug, TipTap `body_json`, sanitized `body_html`, status draft/published, cover, excerpt) |
| `040_email_delivery_log.sql` | `email_delivery_log` - dedupe index on `(template_id, booking_id, recipient_user_id)` for retryable booking lifecycle emails |
| `041_client_saved_vendors.sql` | `client_saved_vendors` - server-side favorites |
| `042_explore_search_columns.sql` | Denormalized `min_list_price_gbp`, `base_city_normalized`, `services_offered` + approved vendor index |
| `043_vendor_market_location.sql` | `vendors.country_code`, `vendors.currency`, `booking_requests.currency` (default GBP/GB); composite explore index on `(country_code, base_city_normalized)` |
| `044_blog_author_name.sql` | `blog_posts.author_name` - public “By …” display name |
| `045_enable_rls_all_public_tables.sql` | Enable RLS on public tables (prefer over leaving 009-only); see Auth RLS note |
| `046_booking_funnel_analytics.sql` | Funnel timestamps on `booking_requests` (`accepted_at`, `vendor_first_response_at`, `payment_requested_at`, `completed_at`, `failure_reason`, …) + backfill |
| `047_marketplace_events.sql` | `marketplace_events` table for profile views and funnel event log |
| `048_enquiry_response_reminders.sql` | Enquiry response friction: `enquiry_reminder_{1h,6h,24h}_at`, `client_no_response_nudge_at`, `client_search_context`; notification kinds + marketplace events for vendor/client nudges and multi-enquire |
| `049_password_reset_tokens.sql` | `password_reset_tokens` - hashed one-click reset tokens (Resend email, 60m expiry, single use) |
| `050_dispute_party_resolution_notes.sql` | Per-party dispute resolution notes (`client_resolution_note` / `vendor_resolution_note`) |
| `051_help_center.sql` | `help_categories` + `help_articles` (audience `client`\|`vendor`\|`both`) + seeded Help Center content |
| `052_help_center_expand_articles.sql` | Longer step-by-step Help articles (upsert by slug); corrects vendor Stripe timing (Connect at accept, not go-live) |
| `053_help_center_admin.sql` | Audience `admin` + seeded admin console walkthrough categories/articles |
| `054_help_center_plain_english.sql` | Rewrites Help articles in plain English (lay terms); upsert by slug |
| `065_help_center_admin_gating.sql` | Patches admin role and broadcast gating copy (superseded in part by 067) |
| `066_help_center_stripe_listing.sql` | Patches admin listing hide vs Connect (superseded in part by 067) |
| `067_help_center_feature_alignment.sql` | Adds planner, onboarding AI, admin directory workflows, referrals articles; rewrites 8 stale articles; plain English, no em dashes (**64 articles** across client/vendor/admin) |
| `068_vendor_growth_copilot_help.sql` | Vendor Growth Co-pilot help articles (`vendor-growth-copilot`, `vendor-growth-score-explained`) |
| `069_help_center_unified_admin_login.sql` | Help Center: unified admin login URL copy |
| `070_vendor_pending_messages_access.sql` | Help Center: pending vendors can open Messages (Eventtz Support) before approval |
| `071_message_rich_body_len.sql` | Raise `messages.body` storage limit for sanitized admin support HTML |
| `055_celebration_plans.sql` | AI Event Planner: `celebration_plans` + `celebration_plan_items` |
| `057_client_events.sql` | `client_events` table + `booking_requests.event_id` FK - multi-vendor planning under one celebration |
| `058_celebration_plans_client_event.sql` | `celebration_plans.client_event_id` FK - planner handoff creates event before first booking |
| `059_booking_review_images.sql` | `booking_reviews.image_urls` text[] - client photo attachments on reviews (Amazon-style, max 5 in app) |
| `060_email_verification.sql` | `users.email_verified_at` + `email_verification_tokens` - client/vendor must verify email before sign-in (backfills existing users) |
| `061_vendor_public_listing_index.sql` | Partial index for the marketplace visibility gate (approved + Stripe charges/payouts enabled) |
| `062_vendor_listing_override.sql` | `vendors.listing_override` (`auto`\|`visible`\|`hidden`) + audit columns; admin can waive the Stripe gate or take a listing down without banning. Rebuilds `vendors_public_listing_idx` to match the new predicate |
| `064_referral_partners.sql` | `referral_partners` + `referral_attributions` - admin-created creator signup links; `shoutout_completed` per referred vendor |
| `083_vendor_client_referrals.sql` | `vendors.client_referral_code`, `booking_requests.vendor_referral_code`, `service_fee_percent` snapshot |
| `084_help_center_vendor_referrals.sql` | (superseded by **087**) placeholder |
| `085_referral_tier_discounts.sql` | `booking_requests.referral_fee_discount_gbp` snapshot at payment; tier discount model |
| `086_help_center_referral_tiers.sql` | (superseded by **087**) placeholder |
| `087_help_center_referral_docs.sql` | Help Center: tiered referral copy, fee-base alignment, new articles (`vendor-client-referrals`, payments hub, notifications, verify email, reviews inbox) |
| `088_vendor_referral_short_codes.sql` | Numeric 1–6 digit referral codes; `POST /vendor/referral/code`; clears legacy slug codes |
| `089_help_center_referrals_settings.sql` | Help Center: vendor client referrals live under Settings > Referrals (not Dashboard) |

### Client events (multi-vendor planning)

- **Table:** `client_events` (title, dates, venue, `status` active/archived) - migration **057**.
- **Booking link:** `booking_requests.event_id` optional FK; denormalized `event_name` / `event_date` / address columns remain on the booking row for vendor views.
- **Planner handoff:** **`POST /client/planner/plans/{id}/ensure-event`** creates or returns `client_events` from plan title/date/location; stores `celebration_plans.client_event_id`. Browse/book flows pass `event_id` in URL; **`useActiveEventPrefill({ linkedEventId })`** auto-applies without banner.
- **Create flow:** `POST /client/booking-requests` accepts optional **`event_id`**. When omitted, `resolve_event_for_booking` creates a new `client_events` row from the submitted event fields. When set, copies fields from the existing event (rejects archived/missing).
- **List API:** client booking list rows include **`event_id`** + **`event_title`** for grouped UI.
- **Frontend:** `lib/clientEventsApi.ts` + `useActiveEventPrefill` banner in booking modals; `groupBookingsByEvent` sections in **`ClientBookingsView`** active tab.
- **AI planner:** hand off to **`/client/browse`** with `vendor_ids` + `event_id`; recommended vendors pre-selected; same booking UX as non-AI browse.
- **Graceful degradation:** if migration 057 is not applied, event list returns `[]`; run **`057_client_events.sql`** and **`058_celebration_plans_client_event.sql`** in Supabase.

### Marketplace analytics

- **Enquiry** = `booking_requests` with `initiator='client'` (not a separate table).
- Funnel columns + `failure_reason` written from booking/status/chat/payments paths (`bookings/funnel.py`).
- SLA: `ENQUIRY_RESPONSE_SLA_HOURS` (default 72) - maintenance job marks `VENDOR_NO_RESPONSE` without changing `status` (analytics only; client-facing reminders are 1h/6h/24h).
- Admin: `GET /api/v1/admin/marketplace-analytics` → Commerce → Marketplace tab (includes reply-within 1h/6h/24h rates, vendor/client nudge counts, multi-enquire batches).
- Vendor: `GET /api/v1/vendor/analytics` → `/vendor/analytics`.
- Events: `app/features/analytics/events.py` → `marketplace_events` (including `vendor_profile_viewed` on explore vendor detail; `enquiry_vendor_reminded` / `enquiry_client_no_response_nudge` / `enquiry_multi_created` for response-friction iteration).

### Markets, location, and currency (multi-country foundations)

UK is the only **enabled** market at launch. Code must read market config - do not hardcode `GB`, `£`, or `"UK"` in new features.

- **Backend:** `app/features/vendors/markets.py` - `MARKETS`, `get_market()`, `normalize_country_code()`, `default_market()`.
- **Frontend:** `lib/markets.ts` - mirror of backend config; `formatMoney()`, `budgetFilterLabel()`, `marketLocationFallback()`.
- **Vendor payload (JSONB):** `countryCode` (required, default `GB`), `baseCity`, optional `region` / `postalCode`. Denormalized on save via `explore_index.explore_search_patch_from_payload()` → `vendors.country_code`, `vendors.currency`.
- **Vendor onboarding step 3:** country-scoped Photon autocomplete (`lib/photonLocationAutocomplete.ts` → `fetchLocationSuggestions(query, { countryCode })`); radius labels from market distance unit (`mi` vs `km`).
- **Explore search:** `GET /vendors/explore/search?country=GB` (default GB). SQL prefilter on `vendors.country_code`. The **LLM is the only query parser** (`search_ai.parse_marketplace_query`): no regex, synonym map, or canned event checklist. Sanitize only drops unknown taxonomy keys, caps lengths, and collapses duplicate catering needs. **Simple** → one flat exact/related/fallback list. **Plan** (e.g. “help me plan my birthday”) → `plan` checklist + per-need `sections`. Each section has client `why` (LLM `rationale`, else a generic compare sentence), `total_count` = unclaimed pool before the card cap, and vendors may include a real `featured_review` (never invented). Multi-service vendors are claimed by the **first** matching need only so they don’t repeat. If OpenAI is unavailable or parse fails, browse stays up in **token-only simple mode** (whitespace keywords; no types, events, or needs). Response also includes `search_mode`, `intent_summary`. Plan mode ignores URL pagination for sections; “See more” should use a simple type filter (not the plan query) so it stays in simple mode.
- **Browse URL:** optional `country` query param (omitted when GB). Frontend `MarketplaceSearchState.country`.
- **Money columns:** existing `*_gbp` fields remain for UK launch; `currency` column (ISO 4217, default `GBP`) on `vendors` and `booking_requests` for future markets. Use `formatMoney(amount, currency)` in new UI - not raw `£` / `formatGbp`.
- **Adding a market:** enable entry in `MARKETS` (backend + frontend), Stripe Connect country, then expose country picker in vendor onboarding + browse filters.


- **`SupabaseAuthService`** - signup, sign-in, refresh, sign-out.
- **Password reset (app-owned):** `POST /auth/forgot-password` issues a URL-safe token, stores **SHA-256** in `password_reset_tokens` (migration 049), emails a one-click link via Resend Jinja (`auth/password_reset.*`) to `{FRONTEND_URL}/reset-password?token=…` (60 minutes, single use). `POST /auth/reset-password` validates the token, updates password with `auth.admin.update_user_by_id`, sets session cookies. `POST /auth/change-password` (authenticated) verifies the current password then updates. Not Supabase Auth recovery emails. Local auth: logs the reset URL; in-memory tokens.
- **Email verification (app-owned, client/vendor signup):** `POST /auth/signup` creates the account, clears any session, sets `users.email_verified_at` null, issues a hashed token in `email_verification_tokens` (migration 060), and emails `{FRONTEND_URL}/verify-email?token=…` (60m, single use; reuses transactional `auth/password_reset.*` templates). `POST /auth/verify-email` marks verified and sends welcome email. `POST /auth/resend-verification` is enumeration-safe. `POST /auth/signin` rejects unverified client/vendor with a clear message. Existing users are backfilled as verified. Admins are not gated.
- **`/me`:** JWT `user_metadata` / `app_metadata` for `user_type`; **`build_app_user`** enriches from DB; optional **`upsert_user_profile`** after signup. **`users.deleted_at`** (migration **077**): closed accounts stay as tombstones for booking FKs. `require_user` / sign-in reject deleted rows; **`upsert_user_profile` must not restore a tombstone**. Shared booking/chat/review FKs are `ON DELETE RESTRICT` so deleting a user row cannot wipe the other party’s history. Self-serve close: **`POST /api/v1/user/account/deletion`**.
- **Vendor profile** routes often use **`require_user`** so onboarding can start before a `vendors` row exists.
- **Vendor portal gating:** `app/vendor/(portal)/layout.tsx` wraps most routes in **`RequireVendorApproved`**, which uses **`vendorIsLiveApproved`** (`submitted` + `approved` in `frontend/lib/vendorAccess.ts`). **`isVendorPreApprovalRoute`** skips that guard for **`/vendor/profile`**, **`/vendor/contact`**, and **`/vendor/messages`** so pending vendors can finish onboarding, use Contact, and read Eventtz Support threads. Pending nav is Profile / Messages / Contact / Settings; the notification bell footer links pending vendors to **Messages** instead of **Notifications**. `PortalShell` does not fetch bookings until the vendor is live approved.
- **Admin return for edits:** `PATCH /api/v1/admin/vendors/{user_id}/unsubmit` sets `status=draft`, `current_step=9` (and `onboardingFlowVersion` 3), and `payload.returnedForEditsAt` (ISO timestamp). Cleared on the next profile **submit** (payload pop before persist). Frontend **`isReturnedForEdits`** is false while `onboarding_status === submitted` (a leftover timestamp must not bounce the wizard 9 ↔ 10). True for draft + timestamp, or legacy draft still parked on the submitted step (`current_step >= 10`). First-time review (draft, step 9, no timestamp) is not “returned”. Copy in `returnedForEditsCopy.ts`. Email uses dual CTAs (Messages + Profile).
- **RLS:** Prefer **`045_enable_rls_all_public_tables.sql`** (RLS on + service-role policies for backend). Older **`009_disable_rls_public_users_vendors.sql`** only if you need a temporary escape hatch while debugging PostgREST; do not leave production on 009-only after 045 is available.

### Error handling from routes

- Success → **`response_model`** instances.
- Failure → **`HTTPException`** with correct status and string **`detail`**; avoid fake “success: false” with HTTP 200 for new APIs.

### Payments (Stripe Connect)

Money is tracked **independently** from the booking request lifecycle:

- **`booking_requests.status`** (`pending`/`accepted`/`declined`/`cancelled`/`completed`) is the request lifecycle - unchanged by payments.
- **`booking_requests.payment_status`** (`unpaid`/`pending`/`paid`/`refunded`/`partially_refunded`/`payout_released`) is the money lifecycle, updated only by `bookings/payments.py` (webhooks, mutual completion, admin dispute actions). `completed` requires `payment_status = 'paid'` (or later).
- **Held-funds model** ("separate charges and transfers"): Checkout charges land in Eventtz's own Stripe balance. Vendor payout is always an explicit `stripe.Transfer`, never automatic Stripe Connect routing - this is what lets a dispute redirect/block funds before the vendor is paid.
- **Vendor payout history** (`GET /api/v1/vendor/payments/history` → `bookings/payout_history.list_vendor_payouts`): shows the vendor's share (`vendor_amount_gbp` / `vendor_portion_gbp`) for `paid` + `payout_released` bookings only - never `total_label` / client total (which includes the Eventtz service fee). Frontend tab: **Payout history** on `/vendor/payments`.
- **Payout trigger:** fully automatic once **both** `client_completion_confirmed_at` and `vendor_completion_confirmed_at` are set (`confirm_completion_for_client`/`confirm_completion_for_vendor` in `bookings/payments.py`) - no admin step in the happy path. Disputes can also trigger a `Transfer` (`release_to_vendor`) or `Refund` (`refund_client`/`partial_refund`) via `admin_ops_service.patch_dispute_case`.
- **48h auto-release (safety net):** if a paid booking's event day has ended and neither party confirmed within `BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT` (default 48h, from end of `event_end_date`/`event_date` UTC) and there is **no active dispute**, the payout is released automatically (`payout_auto_released_at`, migration 036). Pure timing/waiting-on rules live in `bookings/completion_rules.py` (no DB/Stripe imports, so `queries.py` can also use them); orchestration lives in `bookings/payments.py`: detail GET (`maybe_auto_release_payout_for_booking`), hourly cron (`process_due_payout_auto_releases` / `send_completion_reminders`), and list/dashboard active GET (`touch_completion_side_effects_for_booking_rows`) which sends **reminders only** - never Stripe Transfers (list rows omit money fields like `vendor_amount_gbp`). `_finalize_completion` always reloads the full booking row before transferring. Batch scans use `event_day_over` (multi-day events wait until `event_end_date` day ends). Booking detail APIs expose `payout_auto_release_at` + `completion_waiting_on`; list APIs include `completion_waiting_on` for dashboard prompts.
- **Cancellation refunds:** the **vendor** cancelling, or staff cancelling for either party, refunds the client in **full**. The **client** cancelling a paid booking is refunded by the vendor's cancellation preset (`flexible`/`moderate`/`strict`, vendor payload key `cancellationPolicy`, absent = flexible), snapshotted onto `booking_requests.cancellation_policy` when Checkout starts. Tiers, the 24h cooling-off (event ≥ 7 days away) and the pence split live in `bookings/domain_cancellation.py`: the Eventtz fee (everything above `vendor_amount_gbp`) is always refunded; the tier applies to the vendor's price. A tiered cancel ends `cancelled` + `partially_refunded` with `cancellation_refund_percent/_refund_gbp/_vendor_share_gbp` set, and the vendor's share is sent at once by Transfer (`cancellation_payout_at`, `stripe_transfer_id`); if their Stripe setup is unfinished the share is held (`cancellation_payout_at IS NULL`) and the admin **release-payout** tool sends it later. `service_payments.prepare_cancel` runs **before** the status flip - if the Stripe refund fails, the booking stays `accepted`. Cancel is **blocked** when an active dispute exists or `payment_status = payout_released`. Audit columns: `cancelled_by`, `cancelled_at`.
- **Booking maintenance:** `app/jobs/run_booking_maintenance.py` - no HTTP endpoint; uses existing `SUPABASE_*` / `STRIPE_*`. Runs post-event completion reminders (`completion_reminder` / `vendor_completion_reminder`, deduped via `completion_reminder_sent_at`) then due payout auto-releases, then marks stale pending client enquiries (`VENDOR_NO_RESPONSE` after `ENQUIRY_RESPONSE_SLA_HOURS`), then enquiry response outreach (`enquiry_reminders.py`: vendor in-app+email at 1h/6h/24h; client “try other vendors” at 24h using `client_search_context`), then one-shot lifecycle reminders (`lifecycle_reminders.py`: event-tomorrow to both parties on paid bookings; client pay-to-confirm 24h after accept if still `unpaid`; vendor payouts-setup email 24h after `approved_at` if Stripe is not ready). The API starts this hourly when `IS_PRODUCTION=true` (`app/jobs/scheduler.py`). Optional CLI: `PYTHONPATH=. python -m app.jobs.run_booking_maintenance`. Apply migrations **075** (`job_runs`) and **076**.
- **Enquiry response friction:** Client create stores optional `client_search_context` (marketplace filters + multi-enquire `batchSize`/`batchIndex`). Immediate vendor notify stays on create; timed vendor reminders + client alternatives are email + in-app only. Public copy uses “Usually replies within …”. Multi-select enquire on marketplace browse loops `POST /client/booking-requests`. Measure via `marketplace_events` (`enquiry_vendor_reminded`, `enquiry_client_no_response_nudge`, `enquiry_multi_created`) and admin marketplace overview reply-within rates / nudge counts.
- **Plain-language money copy:** all client/vendor-facing payment, cancellation, and completion strings are centralised in `frontend/features/bookings/bookingConfirmCopy.ts` (`BOOKING_CONFIRM_COPY`, `PAYMENT_FLOW_COPY`, `completionWaitingCopy`, `autoReleaseLine`) and notification bodies in `notifications/copy.py` - no "payout released"/"escrow" jargon in user-facing surfaces. Post-event UI: `BookingCompletionBanner.tsx` + dashboard attention items.
- **Idempotency:** every Stripe mutation that moves money (`Transfer.create`, `Refund.create`) uses a deterministic `idempotency_key` so webhook redelivery / retries never double-pay. Transfers use `transfer-{booking_id}-{amount_pence}-{destination}` for platform-balance payouts, or `…-src-{charge_id}` when funded from the Checkout charge (`source_transaction`) so a retry after a failed balance attempt gets a fresh key. Reclaim any existing Transfer by `transfer_group=booking_{id}` before creating. Refunds use `refund-{booking_id}-{suffix}`. Checkout `Session.create` deliberately does **not** use one (a stale/expired session could be returned on retry). Ops `admin.payout_stuck` emails are deduped once per booking via `email_delivery_log`.
- **Transfer funding:** completion Transfers pass `source_transaction` = the booking's `stripe_charge_id` (resolved from `stripe_payment_intent_id` when missing) so Stripe funds the vendor payout from the original Checkout charge even when the platform's available balance is zero because automatic payouts already swept it.
- **Stuck payout retry:** if both parties confirmed but `payment_status` is still `paid` (Transfer failed), `confirm-completion` and booking-detail side effects retry `_finalize_completion` instead of no-op'ing.
- **Webhook dedupe:** `stripe_webhook_events` table records processed event ids before handling; state-changing updates additionally use conditional `.eq("payment_status", "<expected>")` writes (optimistic concurrency) so duplicate deliveries are no-ops.
- Vendor Stripe Connect **Express** accounts are created directly via the API (`payments/stripe.create_connect_onboarding_link`) - no OAuth client id. `vendors.stripe_charges_enabled`/`stripe_payouts_enabled` gate whether a vendor can receive a Checkout payment / payout; `approval_status = approved` alone does **not** imply payable **or visible** (see *Marketplace visibility* below).
- **Connect trigger:** not part of vendor profile onboarding. Stripe Connect is launched from the **Payments** page / dashboard banner, the approved-but-hidden onboarding step, or **Accept booking**. Vendor `PATCH …/status` to `accepted` requires both `charges_enabled` and `payouts_enabled`; client Checkout still requires `stripe_account_id` + `charges_enabled`. Both gates are lifted by a `listing_override = 'visible'` admin waiver (see *Marketplace visibility*); the completion `Transfer` never is.

### Marketplace visibility (approval + Stripe + admin override)

**A vendor is publicly listable only when `approval_status = 'approved'` AND (Stripe Connect is verified OR an admin has waived it)** - and never when an admin has force-hidden them. Approval alone is not enough: a vendor who cannot take a charge or receive a payout would strand the client mid-checkout.

- **One source of truth:** `api/app/features/vendors/domain_visibility.py` - `is_publicly_listable(...)` for in-memory rows, `payouts_verified(...)` for the Stripe half alone, and its SQL twin `_publicly_listed()` in `vendors/repository.py` (used by `marketplace_vendors(listed_only=True)`). **Any new query that exposes vendors publicly must use these** - never re-filter on `approval_status` by hand. `api/tests/guards/test_visibility_helpers_only.py` fails on a new hand-written `approval_status` comparison; a site that asks a different question (moderation, admin counts, referral eligibility) goes in its allow-list with a reason.
- **Applied in** `vendors/moderation.py`: `list_approved_vendors_for_explore`, `get_approved_vendor_for_explore_by_id`, `get_approved_vendor_payload`, `vendor_is_bookable_for_explore`. Because the last is shared, it also gates client booking create, vendor quote create, and **new chat conversations** (`chat/dm.py`).
- **Self-healing:** the `account.updated` Stripe webhook syncs the flags, so a vendor goes live automatically once Stripe verifies them - no admin action needed.
- **Reads never call Stripe by default.** `get_vendor_profile()` is a database read; only `GET /vendor/profile` opts in with `refresh_payouts=True`, because that screen is where a stale "finish payout setup" is visible. It delegates to `payments/stripe.refresh_pending_connect_flags()`, which no-ops unless the vendor has a Connect account that is not yet fully enabled, and writes fresh flags back to the row - so every other reader (profile save, admin approval, contact) stays on stored values. **Never add Stripe I/O inside a shared row read**: `get_vendor_profile` alone has ~9 call sites, and a save would silently cost two Stripe round trips.
- **Surfaced as:** `listing_visible` + `payouts_verified` on `VendorProfileState` (vendor sees why they're hidden) and `AdminVendorRow` (admin Payouts column / review panel). Index: migration **061**, replaced by **062**.

#### Admin listing override (`vendors.listing_override`, migration 062)

Three states, set from the admin vendor review **Actions** tab via `PATCH /api/v1/admin/vendors/{user_id}/listing-override` → `set_vendor_listing_override()`. A reason is required for anything but `auto` and is written to `admin_audit_logs` plus `listing_override_{reason,by,at}`.

**Hide listing does not touch Stripe Connect columns.** If `stripe_account_id` is missing after a payout, restore via `POST /api/v1/admin/vendors/{user_id}/restore-stripe-connect` (super_admin) which reads the destination from the vendor's latest `booking_requests.stripe_transfer_id`. Application policy: **`_clear_vendor_stripe_connect` never runs for vendors with payout history**; sync soft-fails on `PermissionError` instead of wiping Connect.

| State | Effect |
|-------|--------|
| `auto` (default) | Approval + Stripe decide, as above. |
| `visible` | **Waives the Stripe payout gate end to end**: the vendor is listed, can Accept (`bookings/status._vendor_payouts_ready`), and clients can check out (`payment_checkout`). |
| `hidden` | Never listed, even when fully verified - a takedown that, unlike `banned`, keeps the vendor's portal access. |

- **Why waiving Checkout is safe:** the held-funds model means Checkout collects into Eventtz's own balance and never touches the vendor's Connect account. Only the completion `Transfer` needs it, and `payment_completion.py` already holds the money and notifies the vendor when payouts aren't enabled. So a waived vendor can trade; their payout simply waits.
- **Approval still wins:** a `pending` or `banned` vendor stays hidden whatever the override says.
- **Vendor-facing copy** distinguishes the two hidden reasons: `!listing_visible && !payouts_verified` → "finish payout setup"; `!listing_visible && payouts_verified` → "an admin has paused your listing" (`StepSubmitted`, `useOnboardingPersistence`). Never send a paused vendor to Stripe.

### Vendor list pricing (authoritative for client bookings)

List prices and discounts live in **`vendors.payload`** (onboarding JSON). **Never trust client-supplied `unit_price_gbp`.**

- **Module:** `app/features/vendors/list_pricing.py` - parse packages/rates, main list % discount, bulk/off-peak auto lines. A **complete package** requires `title`, `price`, and `details` (min **40** chars). Incomplete packages are excluded from browse/booking options (no “ask the vendor” fallback).
- **Client booking create:** `POST /api/v1/client/booking-requests` accepts **`selected_option_ids`** + event dates only. `create_booking_request` loads the approved vendor payload, calls `resolve_line_items`, then `compute_automatic_discount_lines`, persists the snapshot, and runs `build_pricing_breakdown`.
- **Vendor quotes** (`create_vendor_quote_booking_request`): vendor-entered line prices remain trusted (vendor-initiated).
- **Discount stacking at create:** (1) main list % on each line → (2) bulk % if subtotal ≥ threshold → (3) off-peak % if `event_date` is in **Nov-Feb** (platform default) → **service fee 5%** on full **`vendor_portion_gbp`** (line items + all vendor adjustments). **Vendor client referral** (`vendor_referral_code`): tiered **£10/£15** fixed discount off the Eventtz fee at **£400+/£600+** spend (`vendor_referrals/tiers.py`), not a lower fee %.
- **Automatic discount lines:** synthetic negative rows in `line_items` with ids `auto-bulk` / `auto-off-peak`. Not in `selected_option_ids`. Browse UI may preview via `frontend/lib/vendorDiscountDisplay.ts` (`computeBookingEstimateGbp`); stored amounts always come from the server.
- **Explore min price / marketplace cards:** main list discount only (bulk/off-peak are booking-contextual).
- **Checkout refresh:** `app/features/bookings/pricing_refresh.py` - before Stripe Checkout, `reconcile_automatic_discount_lines` recomputes `auto-bulk` / `auto-off-peak` from the current vendor payload + stored `event_date`, persists updated `line_items` + `total_label`, then charges `client_total_gbp`.
- **Referral pricing (two phases):** (1) **Enquire / browse** — `resolve_referral_pricing_inputs` in `vendor_referrals/validate.py` (strict live validation); persist `vendor_referral_code` + `referral_fee_discount_gbp` via `pricing_snapshot_fields`. (2) **Existing booking** — always `build_pricing_breakdown_for_booking_row` in `vendor_referrals/booking_discount.py`; honor stored code + tier spend; skip only on cross-vendor owner mismatch. **Banned:** raw `build_pricing_breakdown` for booking client totals outside enquire/create math. **Frontend:** committed booking UI reads API `pricing.*`; local `computeClientFeeBreakdown` / `referralDiscountForBookingPreview` only for live previews (enquire modal, vendor adjustment drafts).
- **Stale checkout protection:** webhook/sync finalization rejects sessions whose id ≠ the booking's current `stripe_checkout_session_id`, and verifies Stripe `amount_total` matches session metadata (`client_total_gbp`).
- **Create guard:** reject client bookings when `vendor_portion_gbp <= 0` after breakdown.

### Vendor profile payload validation

On every vendor profile PUT, `normalize_payload_fields` clamps money/discounts, `maxBookingsPerDay` (1-20), and strips non-storage portfolio/doc URLs (`app/features/vendors/payload_validation.py`).

- **Step advance:** when `current_step` increases, `validate_step_fields` runs for the step being completed (location step 3, pricing step 4, availability 6, portfolio 7; step 5 is the cancellation policy, checked by the web app and on submit). Portfolio requires **5-20** images (`MIN_PORTFOLIO_IMAGES` / `MAX_PORTFOLIO_IMAGES` in `payload_validation.py` and `features/vendor/onboarding/constants.ts`).
- **Packages (definition):** one bookable option with **name + price + what's included** (`details`, min 40 chars). Shared rules in `app/features/vendors/package_quality.py` and `frontend/features/vendor/onboarding/packageQuality.ts` (keep in sync). Block vague phrases (`contact for`, `POA`, etc.). **Catering, baking, makeup** require ≥1 complete package before leaving step 4 and on submit. **Profile photo** required on submit.
- **Onboarding UX:** per-step info modals (`onboardingStepGuides.ts`, `OnboardingStepInfoModal.tsx`); category examples on step 4 (`packageExamples.ts`); **AI package coach** `POST /vendor/onboarding/ai/review-packages` (“Help me improve my packages”) handles quality feedback (vague wording, quantities, missing packages, etc.) — suggestions only, never blocks submit. Structural validation (name, price, min description length) stays deterministic in `package_quality.py`.
- **Submit:** when `status` is `submitted` or `complete`, steps 1-8 are validated strictly; `countryCode` defaults to `GB` if missing.
- **Listing photos (admin):** admins drag-reorder profile + portfolio URLs on vendor review (`AdminListingMediaEditor`); first **visible** image is the browse card cover and gallery lead. Hidden URLs are stored in `listingHiddenImageUrls` and omitted from client views. Full admin drag order is stored in `listingDisplayOrder`; vendor `portfolioFileNames` is never rewritten. Public resolution lives in `frontend/lib/vendorPortfolioImages.ts` and `backend/app/features/vendors/listing_media.py`; admin saves via `PATCH /admin/vendors/{id}/listing-media`.
- **Frontend mirror:** `features/vendor/onboarding/vendorOnboardingValidation.ts` + shared limits in `constants.ts` / `packageQuality.ts`.

### Vendor quote & adjustment bounds

- **Quotes:** `validate_quote_line_items` - each line `unit_price_gbp` ≥ £0.01, ≤ £1M; positive vendor portion required (`line_item_validation.py`). Pydantic `BookingLineItemIn` enforces the same range.
- **Adjustments:** `BOOKING_MAX_ADJUSTMENT_GBP` (default **5_000**) per surcharge; sum of positive adjustments capped at `BOOKING_MAX_ADJUSTMENT_PCT_OF_SUBTOTAL` % of line-item subtotal (default **100**, `adjustments.py`).

### Booking calendar capacity

`maxBookingsPerDay` from vendor payload is enforced in `calendar.py` (`_enforce_max_bookings_per_day`) on client and vendor quote booking create - counts overlapping `pending` + `accepted` bookings per calendar day.

**Concurrency:** migration **`033_booking_daily_capacity.sql`** adds a `BEFORE INSERT/UPDATE` trigger with `pg_advisory_xact_lock(vendor, day)` so concurrent creates serialize; the second insert sees the first row and fails if the cap is reached. Python pre-check remains for fast, friendly errors; Postgres is authoritative.

### Admin payment fields

- **Partial refunds:** dispute resolution caps `refund_amount_gbp` to recorded `payment_amount_gbp` for paid bookings (`dispute_ops.py`).
- **Payment patch:** `PATCH /admin/bookings/{id}/payment-fields` - `payment_amount_gbp` is always derived from Stripe `PaymentIntent.amount_received` when a payment intent id is present; client-supplied amounts are ignored (`booking_payment_patch.py`).

### Client chat eligibility

Client-initiated **DM** conversations require `vendor_is_bookable_for_explore` (approved vendor) in `chat/service.py`. Vendor-initiated chat (existing booking relationship) skips this check via `require_bookable_vendor=False`.

### Admin → user support messaging

- One **support** conversation per user (`kind=support`, unique on `support_user_id`).
- Admins compose/search via **`GET /admin/directory/search?q=`** + **`POST /admin/messages/send`**; inbox under **`/admin/messages`**.
- Users see/reply to support threads in the normal **`/chat`** inbox (label “Eventtz Support”); replies bump admin unread + SSE.
- Audit: `chat.admin_send` (and related message actions).

### List filtering (prefer backend)

Search/filter/pagination for directory, disputes, audit, payments, and booking `status=` live on the API - avoid dumping then filtering large lists in the browser. Compose recipient pickers use directory search, not a full client/vendor dump.
---


### Found while freezing marketplace, messaging and bookings (2026-09-26)

The acceptance files pin each of these; the comments marked `BASELINE BUG/QUIRK` there hold the detail.

- **Explore/search:** only `GB` is an enabled market; any other `country` quietly becomes GB. Search uses the same listable pool as explore. Without OpenAI it falls back to a token-only parser (`mode=simple`). An unknown `sort` falls back to `relevance`.
- **Explore scale bug:** `deleted_user_ids` puts every vendor id into one PostgREST `in.(...)` filter. At a few hundred vendors it returns 414, and explore returns 500. The rebuild must not copy this.
- **Favorites** (`client_saved_vendors`): the foreign key points at `users`, not `vendors`, so any known user can be saved. `PUT` is idempotent. `PUT` with an unknown id returns 200 `{"success": false}`. `DELETE` of an id that was never saved succeeds. `merge` counts only the inserts that succeeded (at most 500 ids).
- **Geo:** the address provider is switched off. Autocomplete and find return nothing, and resolve always returns 404. All three need a client session.
- **Vendor analytics:** counts only `initiator = "client"` bookings. `days` is limited to 7–365.
- **Chat not-yours:** GET returns 404, mark-read returns 403, and send returns 400. Staff on the client/vendor chat routes get 403 on list/create and 404 on the others. The older `/admin/chat/.../messages` viewer never returns 404 and has no participant check.
- **Chat create:** when a vendor opens a DM, the create response describes the vendor as the peer. A later GET is correct.
- **Chat edits and broadcasts:** an admin may edit only messages they sent themselves. Only a super admin may broadcast to an audience.
- **Chat bodies:** DM bodies are 1–5000 characters of plain text. Support bodies are sanitised HTML, up to 15000 characters stored, with at most 5000 visible.
- **Bookings status machine:** `pending → accepted|declined|cancelled`, and `accepted → cancelled|completed`. On a vendor-initiated quote, the client accepts or declines and the vendor may only cancel. On a client-initiated request it is the other way round. 404 (never 403) for someone else's booking.
- **Vendor accept gate:** accepting needs a Stripe payout route (or `listing_override = visible`) and no unconfirmed client price adjustment.
- **Declining an adjusted booking:** declining a client-initiated booking with a pending adjustment puts it back to `pending` and clears the adjustments.
- **Bookability:** a vendor is bookable when listable and with a non-empty `payload` (an empty payload is falsy and reads as "not available").
- **Booking money:** `vendor_portion = subtotal + adjustments`, then `service_fee = round(vendor_portion × fee_pct / 100, 2)`, then `client_total = vendor_portion + service_fee`. Adjustments may be edited only on client-initiated bookings that are still pending, and a discount may not take the vendor portion to zero or below.
- **Completion:** needs `accepted` + `paid` and the event day to be over. Without Stripe Connect, a booking both sides have confirmed stays `accepted` / `paid` / `awaiting_other_party`.
- **Dormant bug:** `adjustments.py` has a dormant reference to an undefined `total_label`.
- **Suspension wording:** one message at sign-in ("This account is suspended…") and another mid-session ("Your account has been suspended…").

### Found while freezing notifications, payments, reviews, disputes and the AI helpers (2026-09-26)

Pinned by `acceptance/test_{notifications,payments,reviews,disputes,ai_onboarding}.py`; the `BASELINE QUIRK` comments there hold the detail.

- **Notifications:** marking someone else's notification read answers 200 `{"success": false}`, never 404. A booking notification's title is the booking's event name whenever it has one, so the per-kind titles only appear for unnamed bookings.
- **Payments:** checkout and the staff recovery tools answer 400 (not 404) for a missing booking. Syncing a booking that is already `paid` never calls Stripe.
- **Reviews:** only `status = completed` is checked, never `payment_status`. A body of 10 spaces passes the schema but fails the service's stripped-length check (400). Reviewing someone else's booking is 400, unlike the 404 of the booking routes. Non-http(s) image URLs are dropped silently. Hiding a review id that does not exist still answers 200. Without a `vendors` row, the display name falls back to a fixed string.
- **Disputes:** opening one on another client's booking is 403 (it reveals the booking exists), while listing on it returns an empty list. A staff patch with a money-moving `resolution_action` on a missing dispute is 400 with a full-stop message; without one it is a 404. Resolving needs `status=resolved` and `resolution_action` together. Releasing a payout with no vendor Stripe account succeeds but leaves the booking unchanged.
- **AI helpers:** without an OpenAI key the routes answer 503 `OPENAI_UNAVAILABLE`, except the daily brief, which always falls back to fixed narration. `copilot/ask` rejects `""` with 422 but `"   "` with 400. `draft-reply` for an unknown booking answers 200 with an empty draft and a "Booking not found." tip. Client onboarding (`/client/onboarding`) is already served by the api's identity slice.

### Found while freezing the planner (2026-09-26)

Pinned by `acceptance/test_planner.py`.

- **Stored text is echoed, not recomputed:** plan list and detail return `why_selected`, `cost_assumption` and `summary` as stored. Only replace-item recomputes, and it always excludes the item's current vendor. The budget bands are recomputed on read, split across the plan's own needs by the event type's weights.
- **ensure-event is idempotent:** repeat calls return the same `client_events.id`; archived plans are rejected with `PLAN_ARCHIVED`. Archiving hides a plan from the list but keeps its detail readable.
- **Scalability bug:** the baseline's `list_approved_vendors_for_explore` puts every approved vendor id into one PostgREST query string to fetch emails. Once there are a few hundred vendors the URL is too long and replace-item 500s. The rebuild must read the pool in one SQL query.
- **Price column gap:** the single-vendor lookup the planner uses does not select `min_list_price_gbp`, so fact cards fall back to `payload.min_list_price_gbp`.
- **Not frozen:** a successful create (it needs the LLM) and a successful replace (the bug above, on local data). `api/` covers both with the fake language model.
