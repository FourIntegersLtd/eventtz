-- Admin Help Center: allow audience=admin + seed console walkthrough articles.
-- Run after 051 (and ideally 052). Safe to re-run (upserts by slug).

ALTER TABLE public.help_categories DROP CONSTRAINT IF EXISTS help_categories_audience_check;
ALTER TABLE public.help_categories
  ADD CONSTRAINT help_categories_audience_check
  CHECK (audience IN ('client', 'vendor', 'both', 'admin'));

ALTER TABLE public.help_articles DROP CONSTRAINT IF EXISTS help_articles_audience_check;
ALTER TABLE public.help_articles
  ADD CONSTRAINT help_articles_audience_check
  CHECK (audience IN ('client', 'vendor', 'both', 'admin'));

INSERT INTO public.help_categories (id, slug, title, description, icon_key, sort_order, audience)
VALUES
  ('a1111111-1111-4111-8111-111111111101', 'admin-getting-started', 'Getting started', 'Sign in, roles, and the console layout.', 'rocket', 10, 'admin'),
  ('a1111111-1111-4111-8111-111111111102', 'admin-directory', 'Directory', 'Approve vendors and manage client accounts.', 'user', 20, 'admin'),
  ('a1111111-1111-4111-8111-111111111103', 'admin-commerce-bookings', 'Commerce: bookings', 'Find bookings and run support recovery actions.', 'calendar', 30, 'admin'),
  ('a1111111-1111-4111-8111-111111111104', 'admin-commerce-insights', 'Commerce: money & marketplace', 'Financials summary and marketplace analytics.', 'wallet', 40, 'admin'),
  ('a1111111-1111-4111-8111-111111111105', 'admin-trust', 'Trust & safety', 'Disputes and review moderation.', 'shield', 50, 'admin'),
  ('a1111111-1111-4111-8111-111111111106', 'admin-messages', 'Support messages', 'Inbox replies and compose broadcasts.', 'message', 60, 'admin'),
  ('a1111111-1111-4111-8111-111111111107', 'admin-blog', 'Blog CMS', 'Draft, publish, and edit public blog posts.', 'book', 70, 'admin'),
  ('a1111111-1111-4111-8111-111111111108', 'admin-team-audit', 'Team & activity log', 'Admin team (super admin) and audit trail.', 'settings', 80, 'admin'),
  ('a1111111-1111-4111-8111-111111111109', 'admin-email', 'Email testing', 'Send test transactional emails (super admin).', 'message', 90, 'admin')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order,
  audience = EXCLUDED.audience,
  published = true,
  updated_at = now();

INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-sign-in-console',
  'Sign in and use the admin console',
  'How to open the console, navigate, and sign out.',
  $md$
## Sign in

1. Go to **/admin/login**.
2. Sign in with an account whose user type is **admin**.
3. You land on **/admin/dashboard**.

## Console layout

- **Sidebar** (desktop) or **menu** (mobile): Dashboard, Commerce, Directory, Messages, Blog, Trust & safety, Team, Activity log.
- **Email testing** appears only for **super admins**.
- Your role label shows as **Support admin** or **Super admin**.

## Sign out

Use **Sign out** in the shell. You return to `/admin/login`.

## Help in the console

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. Answers are grounded in these admin docs.
$md$,
  'admin', 10, ARRAY['admin-roles-explained', 'admin-dashboard-overview']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-roles-explained',
  'Support admin vs super admin',
  'What each role can view and change.',
  $md$
## Support admin

Can:

- View dashboard, commerce lists, financials summary, marketplace analytics
- Approve / pending / ban vendors; suspend / unsuspend clients
- Triage disputes (status, assign, party notes); hide / unhide reviews
- Use support Messages and Blog CMS
- Read Team roster and Activity log

Cannot:

- Run booking money / recovery actions
- Resolve disputes with refunds or payouts
- Invite or change admin team roles
- Open Email testing
- Export financials CSV (API is super-admin gated)

## Super admin

Everything a support admin can do, plus:

- Booking **Support actions** (payment sync, payout, hold, cancel, mark complete)
- Dispute **financial resolve** (release to vendor, full or partial refund)
- Team invite / role / suspend
- Email testing
- Financials CSV export API

Money and team changes are written to the **Activity log**.
$md$,
  'admin', 20, ARRAY['admin-sign-in-console', 'admin-booking-support-actions', 'admin-resolve-dispute-money']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-dashboard-overview',
  'Dashboard at a glance',
  'KPIs, needs attention, and charts.',
  $md$
## Open Dashboard

Go to **/admin/dashboard**.

## What you see

- **KPIs** such as pending vendor approvals, active bookings, paid bookings, and engagement signals
- **Needs attention**: pending vendors, open disputes, bookings needing support, pending bookings
- **Charts** for signups and booking pipeline (period filters such as 7 / 30 / 60 / 90 days)

## How to use it

Click attention items to jump into Directory, Trust, or Commerce. Start each shift on Dashboard so you do not miss pending approvals or open disputes.
$md$,
  'admin', 30, ARRAY['admin-approve-vendors', 'admin-find-bookings', 'admin-triage-disputes']
),

(
  'a1111111-1111-4111-8111-111111111102',
  'admin-approve-vendors',
  'Review and approve vendors',
  'Directory Vendors: approve, pending, or ban.',
  $md$
## Path

**Directory → Vendors** (`/admin/directory?tab=vendors`).

## Steps

1. Search or filter the vendor list.
2. Open a vendor for details and insights (ratings, booking counts, disputes, explore link).
3. Set approval to **approved**, **pending**, or **banned**.

## Effects

- **Approved**: vendor can appear on Browse (when their profile is submitted).
- **Pending**: not live for clients.
- **Banned**: blocked from marketplace use as configured.

Changes are audited as vendor approval events in the Activity log.
$md$,
  'admin', 10, ARRAY['admin-suspend-clients', 'admin-dashboard-overview']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-suspend-clients',
  'Suspend or restore client accounts',
  'Directory Clients: suspend and unsuspend.',
  $md$
## Path

**Directory → Clients** (`/admin/directory?tab=clients`).

## Steps

1. Search by email or filter suspended accounts.
2. Open the client row.
3. **Suspend** or **unsuspend** with confirmation.

## When to suspend

Abuse, fraud risk, or policy breaches. Prefer clear notes in related disputes or Activity log context.

Audited as client suspend / unsuspend.
$md$,
  'admin', 20, ARRAY['admin-approve-vendors', 'admin-activity-log']
),

(
  'a1111111-1111-4111-8111-111111111103',
  'admin-find-bookings',
  'Find and open bookings',
  'Commerce Bookings list and booking detail.',
  $md$
## Path

**Commerce → Bookings** (`/admin/commerce?tab=bookings`).

## Filters

- Status
- Event / text search
- Date range
- **Needs attention** style highlights for support diagnostics

## Open a booking

Click a row to open **/admin/bookings/[id]**.

### Detail shows

- Parties (client and vendor)
- Amounts and payment status
- Completion timestamps
- Stripe references when present
- Pricing / line context
- Linked review or dispute when relevant

Any admin can **view**. Money and recovery buttons are **super admin** only (see Support actions).
$md$,
  'admin', 10, ARRAY['admin-booking-support-actions', 'admin-support-hold']
),
(
  'a1111111-1111-4111-8111-111111111103',
  'admin-booking-support-actions',
  'Booking support actions (super admin)',
  'Payment sync, payout, complete, cancel, and related recovery.',
  $md$
## Who

**Super admin** only. Support admins can view the booking and escalate to a super admin.

## Path

Open a booking → **Support actions**.

## Typical actions

- **Check payment**: sync status from Stripe
- **Unblock checkout**: reset a stuck checkout session
- **Pay vendor**: release or retry payout when appropriate
- **Finish cancellation**: complete a cancellation flow that is stuck
- **Mark complete** (client and/or vendor side) when ops need to unblock completion
- **Pause / resume payout** (support hold)
- **Re-run checks**: maintenance-style recheck
- **Cancel on behalf**: choose party and enter a reason (at least 3 characters)

## Safety

Prefer the least invasive action. Confirm Stripe and booking state before payout or refund-related moves. All of these write to the Activity log.
$md$,
  'admin', 20, ARRAY['admin-support-hold', 'admin-roles-explained', 'admin-find-bookings']
),
(
  'a1111111-1111-4111-8111-111111111103',
  'admin-support-hold',
  'Pause payout with support hold',
  'Hold automatic vendor payout while you investigate.',
  $md$
## Who

**Super admin**.

## When

Use while investigating a dispute, chargeback risk, or incomplete event before money should move.

## Steps

1. Open the booking.
2. **Pause payout** (support hold).
3. Investigate via Disputes, Messages, and booking chat as needed.
4. **Resume** hold when it is safe for payout rules to continue.

Support hold is meant to pause automatic release. Pair it with dispute triage when the client or vendor reported a problem.
$md$,
  'admin', 30, ARRAY['admin-booking-support-actions', 'admin-triage-disputes']
),

(
  'a1111111-1111-4111-8111-111111111104',
  'admin-read-financials',
  'Read platform financials',
  'Commerce Financials tab: spend, fees, and charts.',
  $md$
## Path

**Commerce → Financials** (`/admin/commerce?tab=financials`).

## Any admin can

- Pick a period
- Read KPIs such as client spend (GMV), platform fee percentage, paid booking count
- View charts for spend, fees, volume, and held vs released style balances in the summary

## Export CSV

CSV export is **super admin** gated on the API. If a download control is available in the UI, only super admins should use it. Exports are audited.
$md$,
  'admin', 10, ARRAY['admin-marketplace-analytics', 'admin-roles-explained']
),
(
  'a1111111-1111-4111-8111-111111111104',
  'admin-marketplace-analytics',
  'Marketplace analytics',
  'Funnel health: enquiries through completion.',
  $md$
## Path

**Commerce → Marketplace** (`/admin/commerce?tab=marketplace`).

## What to look at

- Funnel: enquiries → accepted → paid → completed and conversion rates
- Response-time style metrics
- Ratings and profile views
- Failure reasons
- Breakdowns by category / location
- Top vendors and recruitment-style hints when shown

Use this tab to spot slow reply rates, drop-offs after accept, and categories that need more vendors.
$md$,
  'admin', 20, ARRAY['admin-read-financials', 'admin-dashboard-overview']
),

(
  'a1111111-1111-4111-8111-111111111105',
  'admin-triage-disputes',
  'Triage disputes',
  'Assign, update status, and leave party-facing notes.',
  $md$
## Path

**Trust & safety → Disputes** (`/admin/trust?tab=disputes`).

## Any admin can

1. Filter by status: open, under_review, resolved, closed.
2. Open a dispute drawer.
3. **Assign** (including to yourself).
4. Change status.
5. Write **party-facing resolution notes** (client, vendor, or both as the UI allows).
6. Open the related booking party chat when needed (viewing chat is audited).

Closing a dispute usually needs confirmation.

## Money resolve

Releasing funds or refunding is **super admin** only. See Resolve disputes with money.
$md$,
  'admin', 10, ARRAY['admin-resolve-dispute-money', 'admin-support-hold']
),
(
  'a1111111-1111-4111-8111-111111111105',
  'admin-resolve-dispute-money',
  'Resolve disputes with money (super admin)',
  'Release to vendor, full refund, or partial refund.',
  $md$
## Who

**Super admin** only.

## Steps

1. Finish triage notes and evidence review.
2. Choose a financial outcome:
   - **Release to vendor**
   - **Full refund to client**
   - **Partial refund** (enter amount in GBP)
3. Resolve so the dispute moves to **resolved**.

Support admins must not set resolution money fields. If you are support, assign a super admin and document the recommendation in notes.
$md$,
  'admin', 20, ARRAY['admin-triage-disputes', 'admin-roles-explained']
),
(
  'a1111111-1111-4111-8111-111111111105',
  'admin-moderate-reviews',
  'Moderate reviews',
  'Hide or unhide public vendor reviews.',
  $md$
## Path

**Trust & safety → Reviews** (`/admin/trust?tab=reviews`), then open a review detail.

## Steps

1. Find the review.
2. Open **/admin/trust/reviews/[id]**.
3. **Hide** from the public profile or **unhide** when appropriate.

Use hide for abuse, spam, or policy breaches. Actions are audited as review hide / unhide.
$md$,
  'admin', 30, ARRAY['admin-triage-disputes', 'admin-activity-log']
),

(
  'a1111111-1111-4111-8111-111111111106',
  'admin-support-inbox',
  'Support inbox',
  'Read, reply, and mark support conversations.',
  $md$
## Path

**Messages → Inbox** (`/admin/messages?tab=inbox`).

## Steps

1. Open unread conversations (badges show on nav and tab).
2. Read the thread.
3. **Reply** as Eventtz Support.
4. Mark read when done.

Realtime refresh keeps unread counts updated. Prefer clear, professional replies and include booking IDs when relevant.
$md$,
  'admin', 10, ARRAY['admin-compose-broadcast', 'admin-find-bookings']
),
(
  'a1111111-1111-4111-8111-111111111106',
  'admin-compose-broadcast',
  'Compose and broadcast messages',
  'Message selected users or all clients / vendors.',
  $md$
## Path

**Messages → Compose** (`/admin/messages?tab=compose`).

## Options

- Selected users (directory search)
- All clients
- All vendors
- All users (when offered)

## Steps

1. Choose audience.
2. Write the message.
3. Send. This creates support conversations.

Broadcasts are audited. Double-check audience before sending platform-wide messages.
$md$,
  'admin', 20, ARRAY['admin-support-inbox', 'admin-suspend-clients']
),

(
  'a1111111-1111-4111-8111-111111111107',
  'admin-blog-cms',
  'Manage blog posts',
  'Create, edit, publish, unpublish, and delete posts.',
  $md$
## Paths

- List: **/admin/blog**
- Editor: **/admin/blog/[id]** (or New post)

## Steps

1. Create or open a post.
2. Edit title, subtitle, slug, author name, cover image, and rich body.
3. **Save** draft.
4. **Publish** when ready for the public site, or **unpublish**.
5. **Delete** only when intentional.

Public readers see published posts on the marketing blog routes. Prefer clear slugs and covers before publish.
$md$,
  'admin', 10, ARRAY['admin-sign-in-console', 'admin-activity-log']
),

(
  'a1111111-1111-4111-8111-111111111108',
  'admin-team-manage',
  'Invite and manage the admin team',
  'Super admin: invite, change roles, suspend admins.',
  $md$
## Path

**/admin/team**.

## Any admin

Can view the roster: email, role, suspended flag.

## Super admin only

- **Invite** a new admin (email + password)
- Change role between **admin** (support) and **super_admin**
- **Suspend** / reactivate (not yourself)
- Backend protects against removing the last super admin

Support admins see read-only guidance to contact a super admin for team changes.
$md$,
  'admin', 10, ARRAY['admin-roles-explained', 'admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111108',
  'admin-activity-log',
  'Use the activity log',
  'Filter and inspect audited admin actions.',
  $md$
## Path

**/admin/audit** (Activity log), detail at **/admin/audit/[id]**.

## Filters

Common categories: bookings, clients, vendors, disputes, reviews, chat, financials, team (plus all).

## How to use

1. Filter to the area you care about.
2. Open an entry for payload / related IDs.
3. Follow links to bookings, vendors, or disputes when shown.

Use the log after money moves, approvals, suspensions, dispute resolves, and team changes.
$md$,
  'admin', 20, ARRAY['admin-team-manage', 'admin-booking-support-actions']
),

(
  'a1111111-1111-4111-8111-111111111109',
  'admin-email-testing',
  'Send test transactional emails',
  'Super admin Email testing console.',
  $md$
## Who

**Super admin** only. Nav item is hidden for support admins.

## Path

**/admin/email**.

## Steps

1. Pick a category (Marketing, Account, Booking, Admin alerts).
2. Choose a template.
3. Enter a recipient.
4. Send a test.

Tests are audited as email test sends. Do not spam real customers. Prefer your own inbox for QA.
$md$,
  'admin', 10, ARRAY['admin-roles-explained', 'admin-activity-log']
)
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order,
  related_slugs = EXCLUDED.related_slugs,
  published = true,
  updated_at = now();
