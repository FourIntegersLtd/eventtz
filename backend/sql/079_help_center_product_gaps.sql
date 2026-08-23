-- Help Center: product gaps since 067-070 (account deletion, receipts,
-- payout hold, reminders). Plain English, no em dashes.

-- ---------------------------------------------------------------------------
-- New vendor Settings category
-- ---------------------------------------------------------------------------
INSERT INTO public.help_categories (id, slug, title, description, icon_key, sort_order, audience)
VALUES
  (
    'b1111111-1111-4111-8111-111111111107',
    'vendor-account',
    'Account',
    'Settings, notifications, and closing your account.',
    'settings',
    70,
    'vendor'
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order,
  audience = EXCLUDED.audience,
  published = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- New articles
-- ---------------------------------------------------------------------------
INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'c1111111-1111-4111-8111-111111111106',
  'client-delete-account',
  'Delete your account',
  'Permanently close your Eventtz account from Settings.',
  $md$
Close your Eventtz account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details.

> [!WARNING]
> This cannot be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. The other person on a booking still sees the date, venue, and amounts.

## Before you start

You will need your current password.

You cannot delete yet if:

- **Payment in progress.** Finish payout or wait for a refund.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

## Delete your account

### 1. Open Settings
From the client area, select **Settings**, then **Account**.

### 2. Confirm and delete
Tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account. The other person still has the booking contract, and your name shows as a deleted user.
$md$,
  'client', 30, ARRAY['client-account-settings','client-password-reset','client-contact-support']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-payment-receipts',
  'Payment history and receipts',
  'See past payments and open a payment receipt.',
  $md$
Download a receipt for a paid booking, or browse everything you have paid, refunded, or paid out.

## Payment history

Open **Payment history** from your portal, or from a paid booking. You will see bookings that have been paid, refunded, or paid out.

## Payment receipt

On a paid booking, open **Payment receipt**. You can view it on screen and download or print the page. The receipt shows the event, amounts (including the Eventtz fee), and payment status.

## If a receipt is missing

Receipts appear after payment succeeds. If you paid and still cannot see one, use **Contact** and include the booking ID.
$md$,
  'client', 40, ARRAY['client-when-do-i-pay','client-payment-safe','client-service-fee']
),
(
  'b1111111-1111-4111-8111-111111111107',
  'vendor-account-settings',
  'Account settings',
  'Password, sharing, notifications, and more under Settings.',
  $md$
Your **Settings** control login, privacy, notifications, and account deletion. These are separate from your public **Profile**.

> [!NOTE]
> Use **Profile** to edit your public listing. Use **Settings** for login, privacy, and closing the account.

## Open Settings

From the vendor area, select **Settings**.

## What you can manage

- **Account.** Email, password, and **Delete account**.
- **Privacy.** Contact sharing and notification preferences.
- **More.** Keyboard shortcuts and legal links.

Keep notification email on so you do not miss new requests, event reminders, or payout messages.
$md$,
  'vendor', 10, ARRAY['vendor-delete-account','vendor-edit-profile','vendor-contact-support']
),
(
  'b1111111-1111-4111-8111-111111111107',
  'vendor-delete-account',
  'Delete your account',
  'Permanently close your vendor account from Settings.',
  $md$
Close your vendor account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details, and your listing leaves Browse.

> [!WARNING]
> This cannot be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. Clients still see the date, venue, and amounts.

## Before you start

You will need your current password.

You cannot delete yet if:

- **Payment or payout in progress.** Finish it first.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

Closing the account also closes payout setup with our payments partner. A new registration starts payout setup again.

## Delete your account

### 1. Open Settings
From the vendor area, select **Settings**, then **Account**.

### 2. Confirm and delete
Tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account.
$md$,
  'vendor', 20, ARRAY['vendor-account-settings','vendor-stripe-payouts','vendor-contact-support']
),
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-payment-documents',
  'Payment record and payout statement',
  'View what the client paid and your payout document after release.',
  $md$
Open **Payments** to set up how you get paid, then view documents for each booking after money has moved.

## Payments page

- **Payout account.** Set up or check how you get paid.
- **Payout history.** Bookings where money has moved.

## On a booking

After the client pays, you can open a **Payment record** (what they paid, including the Eventtz fee on their side). After your payout is released, you can open a **Payout statement** for that booking.

View on screen, then download or print if you need a copy.

## If a document is missing

The payment record appears after the client pays. The payout statement appears after payout is released. If something looks stuck, finish payout setup or use **Contact** with the booking ID.
$md$,
  'vendor', 30, ARRAY['vendor-when-get-paid','vendor-stripe-payouts','vendor-no-cut']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-report-bug',
  'Report a bug',
  'Send a staff bug report from the console.',
  $md$
Use **Report a bug** in the sidebar when something in the console is broken. You can also use it when Help cannot answer.

## What to include

- What you expected
- What happened
- Booking ID, vendor, or client if it is about a live case
- Screenshots if they help

This always files as a bug report. It does not classify the subject with AI.

Open **Settings** to change your admin password. Test accounts on that page are for internal QA only. Do not share those passwords in Help or Messages.
$md$,
  'admin', 40, ARRAY['admin-sign-in-console','admin-roles-explained','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-deleted-accounts',
  'When a user deletes their account',
  'Listings hide, personal details are removed, booking history stays.',
  $md$
Clients and vendors can close their own account from **Settings** with their password. Admins cannot delete their own admin login this way.

> [!NOTE]
> Do not try to remove the user record. The account stays as a deleted placeholder on purpose so the other party keeps their booking history.

## What you will see

- **Deleted user** on bookings, chats, and reviews
- Vendor listings hidden from Browse
- Email, phone, and other personal details stripped
- Shared bookings, chats, reviews, and disputes still in place

## Money and disputes

They cannot delete while money is still moving, an accepted event is still ahead, or a dispute is open. If a payout is held because payout setup was incomplete, that still needs a payout or support action. See **Booking support actions**.
$md$,
  'admin', 30, ARRAY['admin-suspend-clients','admin-booking-support-actions','admin-activity-log']
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

-- ---------------------------------------------------------------------------
-- Client rewrites
-- ---------------------------------------------------------------------------
UPDATE help_articles
SET
  summary = 'Account, Privacy, and More: name, password, sharing, notifications, and delete.',
  body_md = $md$
## Settings

Open **Settings** in the client area. There are three tabs: **Account**, **Privacy**, and **More**.

### Account

- **Preferred name**: shown to vendors on bookings
- **Password**: change while signed in
- **Delete account**: permanently close the account (see **Delete your account**)
- Sign out

### Privacy

- **Contact sharing**: control email and phone sharing
- **Notifications**: booking updates and messages

### More

Keyboard shortcuts and legal links as shown on the page.

## Notifications

Check **Notifications** in the portal for booking updates. Keep your email up to date so you do not miss pay prompts or the day-before event reminder.
$md$,
  related_slugs = ARRAY['client-delete-account','client-password-reset','client-contact-sharing'],
  updated_at = now()
WHERE slug = 'client-account-settings';

UPDATE help_articles
SET
  summary = 'After the vendor accepts. The date is not held until you pay.',
  body_md = $md$
## Timing

You pay **after the vendor accepts**. Asking does not cost anything.

The date is **not held** until payment goes through.

### How to pay

1. Open the accepted booking under **Bookings**.
2. Tap **Pay**.
3. Check the full total (packages, agreed changes, and the Eventtz fee).
4. Pay securely on the payment page.

### Reminders

If you have not paid about **24 hours** after they accept, we remind you to pay to confirm the date.

### After you pay

We hold the money until the event is done (see “Is my payment safe?”). You can open a **Payment receipt** from the booking or **Payment history**.

If payment fails, try again from the same booking or use **Contact** and include the booking ID.
$md$,
  related_slugs = ARRAY['client-service-fee','client-payment-safe','client-payment-receipts','client-how-booking-works'],
  updated_at = now()
WHERE slug = 'client-when-do-i-pay';

UPDATE help_articles
SET
  summary = 'Confirm after the event so the vendor can be paid. We also remind you the day before.',
  body_md = $md$
## Day before

For a paid booking, we send an **event tomorrow** reminder the day before so you have time, venue, and messages in one place.

## After the event

If things went well:

1. Open the booking under **Bookings**.
2. Confirm it is complete when asked.
3. The vendor should confirm on their side too.

When **both** of you confirm, the vendor can be paid sooner.

### Automatic payment

If nobody reports a problem, money can go to the vendor about **48 hours** after the event.

### If something went wrong

Do not confirm. Open a **dispute** from the booking so we can hold the money and review.

### Reviews

After a successful booking you may be asked to leave a review. Honest reviews help other clients.
$md$,
  related_slugs = ARRAY['client-how-booking-works','client-payment-safe','client-leave-review'],
  updated_at = now()
WHERE slug = 'client-complete-booking';

UPDATE help_articles
SET
  summary = 'Rate a vendor after a finished booking. You can add up to five photos.',
  body_md = $md$
## Reviews

After a completed booking, we may ask you to leave a review.

### Tips

- Be fair and specific (timing, quality, communication)
- You can attach up to **five photos** of the event
- Reviews help other clients and good vendors
- If you have an open dispute, sort that first

You may find past reviews under **Settings** when that section is shown.
$md$,
  related_slugs = ARRAY['client-complete-booking','client-are-vendors-vetted'],
  updated_at = now()
WHERE slug = 'client-leave-review';

UPDATE help_articles
SET
  body_md = $md$
## The full flow on Eventtz

Everything stays in one place from first browse to payment.

### 1. Browse and choose

Open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon.

Several vendors for the same celebration can sit together on **Bookings** and **Dashboard**.

### 2. Send a request

Pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**. You can enquire with more than one vendor until you pay.

### 3. Agree the details

Use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept

When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee, before you confirm. You do not pay before they accept. The date is not held until you pay.

### 5. After the event

Confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
$md$,
  related_slugs = ARRAY['client-when-do-i-pay','client-event-planner','client-dashboard','client-multi-enquire'],
  updated_at = now()
WHERE slug = 'client-how-booking-works';

UPDATE help_articles
SET
  body_md = $md$
## Dashboard

Open **Dashboard** when you sign in.

## Attention feed

The top cards show bookings that need action, such as:

- A new price to accept or decline
- Payment ready after the vendor accepted (the date is not held until you pay)
- Confirm the event went well after the date
- Leave a review when invited

Paid bookings for the same celebration can appear together.

## Calendar

Your upcoming bookings appear on the calendar so you can see dates at a glance. We also remind you the day before a paid event.

## Next steps

Tap any card to open the booking. Use **Browse** or **Plan my event** when you are still planning.
$md$,
  related_slugs = ARRAY['client-how-booking-works','client-event-planner','client-when-do-i-pay','client-help-assistant'],
  updated_at = now()
WHERE slug = 'client-dashboard';

-- ---------------------------------------------------------------------------
-- Vendor rewrites
-- ---------------------------------------------------------------------------
UPDATE help_articles
SET
  summary = 'Finish how you get paid before you accept. We nudge you if setup is still open.',
  body_md = $md$
## Set up how you get paid

Open **Payments**, or follow the prompt when you try to **accept** a booking.

### Steps

1. Start how you get paid from **Payout account**.
2. Complete the identity and bank details steps with our payments partner.
3. Return to Eventtz and wait until setup shows as ready.

### Why it matters

You cannot accept a client booking until how you get paid is ready. That way money can move safely after the event.

### After approval

If payout setup is still open about **24 hours** after we approve you, we email a reminder to finish it.

### After a paid event

When everyone confirms (or about **48 hours** after the event with no problem), money goes to your bank on the payments partner’s schedule.

If both sides confirmed but payout setup is not ready, we **hold** the payout until you finish it. Open **Payments** to complete verification.
$md$,
  related_slugs = ARRAY['vendor-when-get-paid','vendor-accept-booking','vendor-payment-documents'],
  updated_at = now()
WHERE slug = 'vendor-stripe-payouts';

UPDATE help_articles
SET
  summary = 'After both sides confirm, or about 48 hours later. Held if payout setup is incomplete.',
  body_md = $md$
## Timing

1. The client pays after you accept. Eventtz holds the money.
2. After the event, you and/or the client confirm it went well.
3. If there is no problem, money can also release about **48 hours** after the event.
4. Then money goes to your bank on the payments partner’s schedule.

When **both** of you confirm, payout can start sooner.

We also send an **event tomorrow** reminder the day before a paid booking.

### If payout is held

If you and the client both confirmed but how you get paid is not ready, we hold the payout and notify you. Open **Payments** and finish payout setup so we can send the funds.

### Other delays

- An open dispute or paused payment
- Bank checks still in progress

Check **Payments** and the booking. Use **Contact** with the booking ID if money is late after it should have been released.
$md$,
  related_slugs = ARRAY['vendor-no-cut','vendor-stripe-payouts','vendor-payment-documents','vendor-complete-cancel'],
  updated_at = now()
WHERE slug = 'vendor-when-get-paid';

UPDATE help_articles
SET
  summary = 'Confirm after paid events. Payout can wait if payout setup is incomplete.',
  body_md = $md$
## After a paid event

1. Open the booking.
2. Confirm **completion** when the work is done.
3. The client should confirm too when asked.

When both of you confirm, payout can start sooner. If nobody reports a problem, money can be released about **48 hours** after the event.

If payout setup is not finished, we hold the payout until you complete it in **Payments**.

## Cancelling

Use cancel on the booking when it is allowed. Rules differ for unpaid requests vs paid bookings. Check the buttons on that booking.

If the client had already paid and a refund is due, Eventtz handles the refund for that booking state. Use **Contact** if something looks stuck.
$md$,
  related_slugs = ARRAY['vendor-when-get-paid','vendor-dispute','vendor-accept-booking'],
  updated_at = now()
WHERE slug = 'vendor-complete-cancel';

UPDATE help_articles
SET
  summary = 'Respond from Bookings once getting paid is set up. We remind you if a request waits.',
  body_md = $md$
## Respond to a request

1. Open **Bookings**.
2. Open the pending request.
3. Read the date, place, packages, and notes.
4. Chat if you need clarity.
5. **Accept** or **Decline**.

### If how you get paid is not ready

Eventtz will ask you to finish bank setup first, then come back to accept. After you return from the payments partner, open the booking again to accept.

### After you accept

The client can pay. The date is not confirmed for them until they pay. Watch **Messages** and **Notifications**.

### Reply quickly

Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.
$md$,
  related_slugs = ARRAY['vendor-stripe-payouts','vendor-price-update','vendor-messages-clients'],
  updated_at = now()
WHERE slug = 'vendor-accept-booking';

UPDATE help_articles
SET
  related_slugs = ARRAY['vendor-analytics','vendor-package-quality'],
  updated_at = now()
WHERE slug = 'vendor-growth-copilot';

UPDATE help_articles
SET
  related_slugs = ARRAY['vendor-growth-copilot','vendor-analytics'],
  updated_at = now()
WHERE slug = 'vendor-growth-score-explained';

-- ---------------------------------------------------------------------------
-- Admin rewrites
-- ---------------------------------------------------------------------------
UPDATE help_articles
SET
  body_md = $md$
## Sign in

1. Go to **/login?next=/admin/dashboard** (legacy **/admin/login** redirects here).
2. Sign in with an account whose user type is **admin**.
3. You land on **/admin/dashboard**.

## Console layout

- **Sidebar** (desktop) or **menu** (mobile): Dashboard, Commerce, Directory, Referrals, Messages, Report a bug, Blog, Trust & safety, Settings, Team, Activity log.
- **Email health** appears only for **super admins**.
- Your role label shows as **Support admin** or **Super admin**.

## Sign out

Use **Sign out** in the shell. You return to the login page.

## Help in the console

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. Answers are grounded in these admin docs. For product bugs, use **Report a bug**.
$md$,
  related_slugs = ARRAY['admin-roles-explained','admin-dashboard-overview','admin-report-bug'],
  updated_at = now()
WHERE slug = 'admin-sign-in-console';

UPDATE help_articles
SET
  summary = 'Check payment, pay vendor, complete, cancel. Payout may stay held until payout setup is ready.',
  body_md = $md$
## Who

**Super admin** only. Support admins can view and ask a super admin for help.

## Path

Open a booking → **Support actions**.

## Typical actions

- **Check payment**: refresh payment status
- **Unblock payment**: clear a stuck payment page
- **Pay vendor**: release or retry paying the vendor when appropriate
- **Finish cancellation**: complete a stuck cancel
- **Mark complete** for client and/or vendor when needed
- **Pause / resume payment** to the vendor
- **Re-run checks**
- **Cancel on behalf**: choose who and enter a reason (at least 3 characters)

## Held payouts

If both parties confirmed completion but the vendor has not finished payout setup, the payout stays **held**. Ask the vendor to open **Payments** and finish setup. Then retry **Pay vendor** if it is still waiting.

Prefer the smallest fix first. Confirm payment state before moving money. Actions are recorded in the Activity log.
$md$,
  related_slugs = ARRAY['admin-support-hold','admin-roles-explained','admin-find-bookings','admin-deleted-accounts'],
  updated_at = now()
WHERE slug = 'admin-booking-support-actions';

UPDATE help_articles
SET
  related_slugs = ARRAY['admin-sign-in-console','admin-booking-support-actions','admin-report-bug','admin-listing-visibility'],
  updated_at = now()
WHERE slug = 'admin-roles-explained';
