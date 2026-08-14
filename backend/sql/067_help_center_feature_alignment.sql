-- Help Center: align articles with current product features (planner, onboarding AI,
-- admin directory workflows, referrals). Plain English, no em dashes.

-- New categories
INSERT INTO public.help_categories (id, slug, title, description, icon_key, sort_order, audience)
VALUES
  (
    'c1111111-1111-4111-8111-111111111107',
    'client-planning',
    'Planning',
    'Use AI to plan your celebration and find vendors.',
    'sparkles',
    15,
    'client'
  ),
  (
    'a1111111-1111-4111-8111-111111111110',
    'admin-referrals',
    'Referrals',
    'Create referral partners and track signups.',
    'user',
    25,
    'admin'
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order,
  audience = EXCLUDED.audience,
  published = true,
  updated_at = now();

-- New articles (11)
INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'c1111111-1111-4111-8111-111111111107',
  'client-event-planner',
  'Plan my event with AI',
  'Describe your celebration and get a budget, checklist, and vendor ideas.',
  $md$
## Open the planner

From your portal, go to **Plan my event**.

## What to do

1. Describe your event in plain English (for example: "Birthday party for 80 people in London in June, need catering and a DJ").
2. Review the plan Eventtz creates: budget breakdown, checklist, and vendor suggestions.
3. Tap **Book now** on a suggestion to open **Browse** with useful filters already set.
4. Save the plan and come back later from **Plan my event**.

## Tips

- You can still browse and book without the planner.
- The planner helps you compare what you might need before you send requests.
- When you are ready, send booking requests from **Browse** or **Favourites** as usual.
$md$,
  'client', 10, ARRAY['client-browse-vendors','client-how-booking-works','client-dashboard']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-dashboard',
  'Your dashboard',
  'See what needs your attention: quotes, payments, completion, and reviews.',
  $md$
## Dashboard

Open **Dashboard** when you sign in.

## Attention feed

The top cards show bookings that need action, such as:

- A new price to accept or decline
- Payment ready after the vendor accepted
- Confirm the event went well after the date
- Leave a review when invited

## Calendar

Your upcoming bookings appear on the calendar so you can see dates at a glance.

## Next steps

Tap any card to open the booking. Use **Browse** or **Plan my event** when you are still planning.
$md$,
  'client', 5, ARRAY['client-how-booking-works','client-event-planner','client-help-assistant']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-help-assistant',
  'Using Help and Ask',
  'Browse articles or ask the Help assistant in the portal.',
  $md$
## Open Help

Tap the **?** button at the bottom of your screen (Help).

## Browse articles

Pick a category, then open an article for step-by-step guides on booking, payments, and account settings.

## Ask a question

Use **Ask** to type a question in your own words. The assistant answers from Eventtz help articles.

### When to use something else

- **Help** and **Ask**: how-to questions ("How do I pay?", "How do bookings work?").
- **Contact**: account problems or payment failures we need to investigate.
- **Disputes**: something went wrong with a paid or finished booking.

If Ask cannot answer safely (for example about refunds or bans), it will tell you to use **Contact** or **Disputes**.
$md$,
  'client', 15, ARRAY['client-contact-support','client-how-booking-works','client-report-problem']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-package-quality',
  'Pricing, packages, and AI help',
  'Build clear packages and use AI tools on Pricing and Review.',
  $md$
## Packages on Pricing (Step 4)

Each **package** is one bookable service with a name, price, and **What's included** text. Clients need enough detail to know what they are booking.

### Good packages include

- A clear name (for example "Full day wedding photography")
- A price
- **What's included** with real detail (hours, deliverables, travel rules)
- A profile photo on your account before you submit

Some categories (such as catering or baking) need at least one complete package before you can submit.

## Package Coach (AI)

On **Pricing**, open **Help me improve my packages**. Eventtz reviews your packages and can suggest clearer names and descriptions. Review the changes, then save.

AI can make mistakes. Always check prices and details before you submit.

## Bio on Review (Step 8)

On **Review**, you can **Generate bio with AI** or write your own. Keep it honest and under the word limit shown on screen.

## After admin feedback

If we return your profile for edits, fix the items in the email and Eventtz Support message, then submit again from **Profile**.
$md$,
  'vendor', 15, ARRAY['vendor-onboarding-steps','vendor-profile-returned','vendor-edit-profile']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-profile-returned',
  'If we ask you to update your profile',
  'Your profile may go back to draft with a message explaining what to fix.',
  $md$
## What happened

Our team reviewed your submission and needs a few updates before we can approve you.

We return your profile to **draft** so you can edit it again.

## What you receive

1. An **email** with the list of what to fix and a link to **Profile**.
2. The same message in **Eventtz Support** (open **Messages** and look for Eventtz Support).

## What to do

1. Sign in and open **Profile**.
2. Update the items we listed (photos, packages, bio, and so on).
3. Submit again when you are ready.

We review resubmissions in the same queue as new applications.
$md$,
  'vendor', 25, ARRAY['vendor-package-quality','vendor-onboarding-steps','vendor-contact-support']
),
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-pending-access',
  'What you can do while waiting for approval',
  'Edit Profile and Contact while pending. Bookings unlock after approval.',
  $md$
## While your profile is pending

You can usually:

- Open **Profile** and finish or fix your application
- Use **Contact** to reach Eventtz
- Read **Help** and use **Ask**

## Locked until you are approved

These areas stay unavailable until we approve you:

- **Bookings** (accepting client requests)
- **Analytics**
- Most other vendor tools that assume you are live

## After approval

Once approved, you can open **Bookings**, **Messages**, **Payments**, and **Analytics**. You still need payout setup finished before you can **accept** a paid booking.
$md$,
  'vendor', 5, ARRAY['vendor-when-live','vendor-stripe-payouts','vendor-onboarding-steps']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-referral-signup',
  'Joining through a referral link',
  'Register with a partner link so Eventtz knows who referred you.',
  $md$
## Referral links

Some partners share a special **vendor register** link. If you open that link, Eventtz records the referral when you create your account.

## What you do

1. Open the link your partner sent.
2. Complete **vendor register** as usual.
3. Finish **Profile** and submit when ready.

The referral does not change how approval or payouts work. It only helps Eventtz and the partner track signups.
$md$,
  'vendor', 30, ARRAY['vendor-how-to-join','vendor-onboarding-steps']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-vendor-submission-review',
  'Review a submitted vendor profile',
  'Open a vendor, read the checklist, then approve, return for edits, or ban.',
  $md$
## Path

**Directory → Vendors**. Filter **Profile → submitted** and **Approval → pending** when triaging new applications.

## Submission checklist

Open a vendor to see their full application and a **checklist** of required items (photos, packages, bio, policies, and similar).

Use the checklist to decide:

- **Approve** when the profile is ready
- **Return for edits** when they can fix issues and resubmit
- Leave **pending** while you are still reviewing

## Related guides

- **Return for edits**: send a message and unlock their profile
- **Publish anyway / Hide listing**: control visibility after approval
- **Email draft vendors**: nudge people who never submitted
$md$,
  'admin', 5, ARRAY['admin-approve-vendors','admin-return-for-edits','admin-nudge-draft-vendors']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-return-for-edits',
  'Return a vendor profile for edits',
  'Unlock a submitted profile, email the vendor, and send an Eventtz Support message.',
  $md$
## When to use this

The vendor submitted but the checklist shows missing or weak items you want them to fix themselves.

## Path

**Directory → Vendors** → open the vendor → **Return for edits**.

## Steps

1. Review the pre-filled message (missing checklist items are listed automatically). Edit it if needed.
2. Click **Return and send message**.

## What happens

- Profile status goes back to **draft** so they can edit **Profile**.
- They receive an **email** with your message and a link to update their profile.
- The same text is sent in **Eventtz Support** (**Messages** on their side).

When they fix the issues, they submit again. You review from the same Directory list.
$md$,
  'admin', 15, ARRAY['admin-vendor-submission-review','admin-approve-vendors','admin-support-inbox']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-nudge-draft-vendors',
  'Email draft vendors to complete profile',
  'Select draft vendors and send a reminder email to finish and submit.',
  $md$
## Path

**Directory → Vendors**. Filter **Profile → draft**.

## Steps

1. Tick the checkboxes on draft vendors (or select all draft on the page).
2. Click **Send complete profile email**.
3. Read the toast: it shows how many emails sent, skipped, or failed.

## Who receives email

Only vendors still in **draft** get the email. Submitted or approved vendors are skipped.

## If send fails

Failures usually mean no email address on the user account. Check the vendor row or user record before retrying.
$md$,
  'admin', 20, ARRAY['admin-vendor-submission-review','admin-approve-vendors','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-listing-visibility',
  'Publish anyway, hide listing, and automatic',
  'Control whether approved vendors appear on Browse.',
  $md$
## Three listing modes

On an approved vendor in **Directory → Vendors**:

- **Automatic**: default rules apply (approval, payout setup, and profile completeness).
- **Publish anyway**: show on Browse even when automatic rules would hide them (**super admin** only).
- **Hide listing**: keep them off Browse even if payouts are ready (**super admin** only).

**Support admin** can set listing back to **Automatic** only.

## Hide listing vs payout setup

**Hide listing** only affects Browse visibility. It does not remove payout account details.

## Restore payout account (super admin)

If a vendor was paid before but their payout account looks missing in the console, open the vendor **Actions** tab and use **Restore from payout transfer** when shown. This copies the account id from their latest payout record.

Use this when Connect data was cleared by mistake, not for routine listing changes.
$md$,
  'admin', 25, ARRAY['admin-approve-vendors','admin-roles-explained','admin-vendor-submission-review']
),
(
  'a1111111-1111-4111-8111-111111111110',
  'admin-referral-partners',
  'Referral partners and signup links',
  'Create partners, copy register links, and see who signed up.',
  $md$
## Path

**Referrals** in the admin sidebar.

## Create a partner

1. Open **Referrals**.
2. Add a partner name (and notes if you use them).
3. Copy the **vendor register** link and share it with the partner.

## Track signups

Open a partner to see vendors who registered through that link. Attribution is recorded on first signup from the link.

Referrals do not change vendor approval or payout rules. They are for tracking and partner relationships only.
$md$,
  'admin', 10, ARRAY['admin-approve-vendors','admin-dashboard-overview']
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

-- Rewrite existing articles (8)
UPDATE help_articles
SET
  body_md = $md$
## Eight profile steps

Open **Profile** and work through each step. Progress saves as you go.

1. **Account** – contact details and profile photo
2. **Business** – business name, services, and bio basics
3. **Location** – where you work and travel rules
4. **Pricing** – packages with clear **What's included** text (see **Pricing, packages, and AI help**)
5. **Availability** – when you can take bookings
6. **Portfolio** – photos (and video if you offer it)
7. **Additional info** – optional certificates or disclosures
8. **Review** – check everything, then **Submit for review**

## While waiting

Some fields may stay read-only until we finish review. If we need changes, we return your profile to draft and email you (see **If we ask you to update your profile**).

## After approval

Edit your live listing from **Profile**. Keep packages, photos, and availability up to date.
$md$,
  summary = 'Eight steps from Account through Review, then submit.',
  related_slugs = ARRAY['vendor-package-quality','vendor-how-to-join','vendor-when-live','vendor-pending-access'],
  updated_at = now()
WHERE slug = 'vendor-onboarding-steps';

UPDATE help_articles
SET
  body_md = $md$
## Going live is three separate things

### 1. Submit and get approved

Finish **Profile** and **Submit for review**. Our team approves when the listing meets our standards.

### 2. Browse visibility

After approval, clients can usually find you on **Browse** when automatic listing rules pass. Admins can also hide or force-publish a listing (see admin docs).

### 3. Payout setup before accepting bookings

Setting up how you get paid is **not** required to be approved. You **do** need it finished before you can **accept** a booking that will be paid through Eventtz.

## Where to check

**Profile**, **Dashboard**, and **Payments** show approval status, listing reminders, and payout setup.
$md$,
  summary = 'Approval, Browse visibility, and payout setup are separate steps.',
  related_slugs = ARRAY['vendor-stripe-payouts','vendor-pending-access','vendor-onboarding-steps'],
  updated_at = now()
WHERE slug = 'vendor-when-live';

UPDATE help_articles
SET
  body_md = $md$
## The full flow on Eventtz

Everything stays in one place from first browse to payment.

### 1. Browse and choose

Open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon.

### 2. Send a request

Pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**.

### 3. Agree the details

Use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept

When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee, before you confirm. You do not pay before they accept.

### 5. After the event

Confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
$md$,
  summary = 'Browse, request, agree, pay after accept, then confirm completion.',
  related_slugs = ARRAY['client-when-do-i-pay','client-event-planner','client-dashboard','client-multi-enquire'],
  updated_at = now()
WHERE slug = 'client-how-booking-works';

UPDATE help_articles
SET
  body_md = $md$
## Path

**Directory → Vendors**.

## Review before you decide

1. Search or filter (try **submitted** + **pending** for new applications).
2. Open a vendor and read the **submission checklist**.
3. Choose an action:
   - **Approved**: vendor can go live on Browse when listing rules allow
   - **Pending**: stays off the marketplace while you review
   - **Banned**: blocked from the marketplace
   - **Return for edits**: unlock profile and send them a fix list (see dedicated article)

## Listing and payouts

Approval is not the same as Browse visibility or payout setup. Use **Publish anyway / hide listing** when you need manual control (super admin).

Changes are recorded in the **Activity log**.
$md$,
  summary = 'Use the checklist, then approve, pending, ban, or return for edits.',
  related_slugs = ARRAY['admin-vendor-submission-review','admin-return-for-edits','admin-listing-visibility','admin-suspend-clients'],
  updated_at = now()
WHERE slug = 'admin-approve-vendors';

UPDATE help_articles
SET
  body_md = $md$
## Support admin

Can:

- View dashboard, commerce lists, financials summary, marketplace analytics
- Approve, pending, or ban vendors; set listing back to **Automatic**; suspend or unsuspend clients
- Triage disputes (status, assign, party notes); hide or unhide reviews
- Send support messages to **selected users**; use Blog CMS
- Read Team roster and Activity log

Cannot:

- Run booking money or recovery actions
- Resolve disputes with refunds or payouts
- Force **Publish anyway** or **Hide listing**
- Broadcast messages to all clients, vendors, or users
- Restore payout account from history
- Invite or change admin team roles
- Open Email testing
- Export financials spreadsheet (super admin only)

## Super admin

Everything a support admin can do, plus:

- **Publish anyway** and **Hide listing** on vendors
- Support message **audience broadcasts** (all clients, vendors, or users)
- **Restore from payout transfer** on vendors when payout history exists
- Booking **Support actions** (payment sync, payout, hold, cancel, mark complete)
- Dispute **financial resolve** (pay vendor, full or partial refund)
- Team invite, role changes, suspend
- Email testing
- Financials spreadsheet export

## More detail

See **Publish anyway, hide listing, and automatic** for listing modes. See **Return a vendor profile for edits** and **Email draft vendors** for directory workflows.
$md$,
  updated_at = now()
WHERE slug = 'admin-roles-explained';

UPDATE help_articles
SET
  body_md = $md$
## Path

**Messages → Compose** (`/admin/messages?tab=compose`).

## Options

- **Selected users** (directory search): any support admin
- **All clients**, **All vendors**, or **All users**: **super admin only**

## Steps

1. Choose audience.
2. Write the message.
3. Send. This creates support conversations.

Broadcasts are audited. Double-check audience before sending platform-wide messages.
$md$,
  updated_at = now()
WHERE slug = 'admin-compose-broadcast';

UPDATE help_articles
SET
  body_md = $md$
## Path

**Commerce → Marketplace**.

## What to look at

- Steps from request to accept to pay to complete, and conversion rates
- How fast vendors reply to new enquiries
- Enquiry reminder counts (timed nudges when vendors are slow to respond)
- Client nudges when vendors do not reply within 24 hours
- Ratings and profile views
- Why bookings fail when that is shown
- Breakdowns by category and place
- Top vendors when shown

Use this to spot slow replies and drop-offs after accept.
$md$,
  summary = 'Funnel metrics plus enquiry reminder and client nudge counts.',
  related_slugs = ARRAY['admin-read-financials','admin-find-bookings','admin-dashboard-overview'],
  updated_at = now()
WHERE slug = 'admin-marketplace-analytics';

UPDATE help_articles
SET
  body_md = $md$
## Contact

Open **Contact** in your portal to message Eventtz.

### Include

- Your account email
- Booking ID for booking or payment issues
- A clear description (and screenshots if useful)

We aim to reply by email within about **two working days**.

### Help vs Contact vs Disputes

- Tap **? Help**, browse articles, or use **Ask** for how-to questions
- Use **Contact** for account problems or payment failures
- Use **Disputes** for problems with a paid or finished event
$md$,
  related_slugs = ARRAY['client-help-assistant','client-report-problem','client-are-vendors-vetted'],
  updated_at = now()
WHERE slug = 'client-contact-support';

UPDATE help_articles
SET
  body_md = $md$
## Contact

Open **Contact** in the vendor area.

### Include

- Account email
- Booking ID for payment or dispute questions
- Screenshots for payment setup errors

We aim to reply by email within about **two working days**.

### Help vs Contact vs Disputes

- Tap **? Help**, browse articles, or use **Ask** for how-to questions first
- Use **Contact** for account or payout setup problems
- Use **Disputes** for active booking problems
$md$,
  related_slugs = ARRAY['vendor-profile-returned','vendor-dispute','vendor-stripe-payouts'],
  updated_at = now()
WHERE slug = 'vendor-contact-support';

-- Cross-link existing articles to new content
UPDATE help_articles
SET related_slugs = ARRAY['client-event-planner','client-dashboard','client-how-booking-works','client-favourites'],
    updated_at = now()
WHERE slug = 'client-browse-vendors';

UPDATE help_articles
SET related_slugs = ARRAY['vendor-onboarding-steps','vendor-package-quality','vendor-pending-access'],
    updated_at = now()
WHERE slug = 'vendor-how-to-join';

UPDATE help_articles
SET related_slugs = ARRAY['admin-roles-explained','admin-vendor-submission-review','admin-listing-visibility'],
    updated_at = now()
WHERE slug = 'admin-dashboard-overview';

UPDATE help_articles
SET related_slugs = ARRAY['admin-compose-broadcast','admin-return-for-edits','admin-roles-explained'],
    updated_at = now()
WHERE slug = 'admin-support-inbox';

UPDATE help_articles
SET related_slugs = ARRAY['admin-roles-explained','admin-referral-partners','admin-dashboard-overview'],
    updated_at = now()
WHERE slug = 'admin-sign-in-console';

UPDATE help_articles
SET
  body_md = $md$
## Sign in

1. Go to **/admin/login**.
2. Sign in with an account whose user type is **admin**.
3. You land on **/admin/dashboard**.

## Console layout

- **Sidebar** (desktop) or **menu** (mobile): Dashboard, Commerce, Directory, Referrals, Messages, Blog, Trust & safety, Team, Activity log.
- **Email testing** appears only for **super admins**.
- Your role label shows as **Support admin** or **Super admin**.

## Sign out

Use **Sign out** in the shell. You return to the admin login page.

## Help in the console

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. Answers are grounded in these admin docs.
$md$,
  updated_at = now()
WHERE slug = 'admin-sign-in-console';
