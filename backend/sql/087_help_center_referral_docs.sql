-- Help Center: tiered client referrals, fee-base alignment, and product-gap articles.
-- Plain English, polite second person, NOTE/WARNING callouts, ### N. steps. No em dashes.
-- Run after 086. Fixes 084/086 (wrong table help_center_articles).

-- ---------------------------------------------------------------------------
-- Category descriptions
-- ---------------------------------------------------------------------------
UPDATE public.help_categories
SET
  description = CASE slug
    WHEN 'client-payments' THEN 'When you pay, the 5% fee, referral savings, and how we hold your money.'
    WHEN 'vendor-earnings' THEN 'Fees, referral links for clients, payouts, and payment documents.'
    ELSE description
  END,
  updated_at = now()
WHERE slug IN ('client-payments', 'vendor-earnings');

-- ---------------------------------------------------------------------------
-- New articles (upsert)
-- ---------------------------------------------------------------------------
INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-client-referrals',
  'Share a referral link with clients',
  'Give clients tier savings on the Eventtz fee. You still keep your full quote.',
  $md$
Every approved vendor gets a **client referral code** and share link on the **Dashboard**. When a client books with your link or code, they can save on the **Eventtz booking fee**. Your quote and payout stay the same.

> [!NOTE]
> This is different from a **partner signup link** (`?ref=` on vendor register). Client referrals use `?vref=` on your listing and lower the client's Eventtz fee only.

## Tier savings (off the Eventtz fee)

| Vendor total on the booking | Client saves |
|-----------------------------|--------------|
| £400+ | £10 |
| £600+ | £15 |

The best qualifying tier applies (not cumulative). If the total drops below a tier before checkout, the discount updates automatically.

## Your referral code

Your code is **1 to 6 digits** (for example `482910`). Choose your own on the dashboard or tap **Generate** for a random code.

### 1. Open your dashboard
Please open **Dashboard** and find the **Client referrals** section.

### 2. Copy your link or code
Copy the share link or the code itself. Send it by email, social, or your website.

### 3. How clients use it
Clients can open your listing with `?vref=your-code` in the link, or enter the code when they send a booking request.

## Tracking

The same section lists bookings that used your code: event name, date, status, vendor total, and how much the client saved on the Eventtz fee.

## What you keep

Eventtz charges clients a **5% fee** on the full vendor total (packages plus any surcharges or discounts you add). Referral savings come off that fee only. You still receive your agreed vendor amount.
$md$,
  'vendor', 15, ARRAY['vendor-no-cut','vendor-dashboard','vendor-when-get-paid','vendor-referral-signup']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-payments-hub',
  'Payment history',
  'See everything you have paid, refunded, or paid out in one place.',
  $md$
Open **Payment history** from the client menu to see bookings where money has moved: paid, refunded, or paid out to the vendor.

> [!NOTE]
> You can also open a **Payment receipt** from an individual booking after you pay.

Each row shows the event, date, status, and amount. Tap a booking to open full details, messages, and receipts.

If you paid but a booking is missing from the list, use **Contact** and include the booking ID.
$md$,
  'client', 35, ARRAY['client-payment-receipts','client-when-do-i-pay','client-service-fee','client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-notifications',
  'Notifications',
  'See booking updates, messages, and reminders in one place.',
  $md$
Open **Notifications** from the client menu. You will see booking updates, payment reminders, message alerts, and other activity.

Unread items are highlighted. Tap a notification to open the related booking, chat, or page.

You can control email alerts in **Settings > Notifications**.
$md$,
  'client', 25, ARRAY['client-dashboard','client-how-booking-works','client-account-settings']
),
(
  'b1111111-1111-4111-8111-111111111107',
  'vendor-notifications',
  'Notifications',
  'See new requests, messages, and payout updates.',
  $md$
Open **Notifications** from the vendor menu. You will see new booking requests, client messages, payment and payout updates, and reminders.

Unread items are highlighted. Tap a notification to open the booking, chat, or related page.

You can control email alerts in **Settings > Notifications**.
$md$,
  'vendor', 15, ARRAY['vendor-accept-booking','vendor-messages-clients','vendor-account-settings']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-verify-email',
  'Confirm your email',
  'Verify your address so you can sign in and receive booking updates.',
  $md$
After you register, we may ask you to **confirm your email**. Please open the link in the email we send, then sign in again.

> [!NOTE]
> Check spam if you do not see the message within a few minutes. You can request a new link from the sign-in page.

Verified email helps with password reset and payment receipts.
$md$,
  'client', 15, ARRAY['client-create-account','client-password-reset','client-account-settings']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-reviews-inbox',
  'Reviews on your profile',
  'See client reviews and your average rating.',
  $md$
Clients can leave a review after a completed booking. Open **Profile > Reviews** (or **Reviews** from your menu) to read them.

Your average rating and review count appear on your public listing and help clients choose you.

> [!NOTE]
> You cannot edit a client's review. If you believe one breaks our rules, use **Contact** with the booking ID.

Reply professionally in **Messages** if you want to follow up with the client.
$md$,
  'vendor', 35, ARRAY['vendor-analytics','vendor-edit-profile','client-leave-review']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-dashboard',
  'Your dashboard',
  'See new requests, referral sharing, bookings calendar, and what needs attention.',
  $md$
Open **Dashboard** when you sign in. It is your home for what needs action today.

## What you will see

- **Attention** cards for new booking requests, unread messages, and payout setup if it is not finished.
- **Client referrals** to copy your share link, see tier savings, and track bookings that used your code.
- **Bookings calendar** and upcoming events.
- **Growth Co-pilot** tips when available.

Please respond to new requests from **Bookings** or the attention cards. Faster replies win more bookings.

If payout setup is not ready, finish it from **Payments** before you accept paid bookings.
$md$,
  'vendor', 5, ARRAY['vendor-accept-booking','vendor-client-referrals','vendor-growth-copilot','vendor-notifications']
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
-- Fee + referral updates (supersedes 084 and 086)
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  title = 'Is there a service fee?',
  summary = 'Yes, 5% on the vendor total. Referral links can save £10–£15 off that fee.',
  body_md = $md$
Eventtz adds a **5% fee** on top of the vendor total you see on the booking. That total includes packages plus any surcharges or discounts the vendor adds. There are no surprise extras beyond what the booking already shows.

> [!NOTE]
> The full breakdown is always shown before you send a request or pay. Vendors keep the price you agreed with them.

## Referral savings

If the vendor shared a referral link or code (`?vref=` on their listing), you may save on the **Eventtz fee** (not the vendor's price):

| Vendor total | Savings off Eventtz fee |
|--------------|-------------------------|
| £400+ | £10 |
| £600+ | £15 |

Enter the code on the booking form, or open the vendor's share link. The booking page shows the exact fee before you pay.

## Your breakdown

Before you pay you always see:

- **Vendor portion.** What you agreed with the vendor.
- **Eventtz fee.** 5% of the vendor total, minus any referral savings.
- **Total due.** Vendor portion plus the Eventtz fee due.

We do not take a cut out of the vendor's quote. The fee is paid by you on top.
$md$,
  related_slugs = ARRAY['client-when-do-i-pay','client-payment-safe','client-payment-receipts','vendor-client-referrals'],
  updated_at = now()
WHERE slug = 'client-service-fee';

UPDATE public.help_articles
SET
  summary = 'No. Clients pay the 5% fee on top of your full quote, including surcharges.',
  body_md = $md$
Eventtz does **not** take a cut from your agreed quote. Clients pay a **5% Eventtz fee** on top of the **vendor total** on the booking (packages plus any surcharges or discounts you add). You keep the vendor amount shown on the booking.

> [!NOTE]
> If you share a **client referral link**, savings come off the client's Eventtz fee only. Your payout is unchanged. See **Share a referral link with clients**.

### Example

If your quote is £400 and the client booked with your referral link at the £400 tier, they pay £400 to you plus a reduced Eventtz fee (£10 instead of £20). Your earnings for that booking are still £400 (unless a dispute changes the outcome).

If you add a £50 travel surcharge, the vendor total becomes £450. The client's Eventtz fee is 5% of £450, minus any referral tier that still applies.
$md$,
  related_slugs = ARRAY['vendor-when-get-paid','vendor-stripe-payouts','vendor-client-referrals','vendor-price-update'],
  updated_at = now()
WHERE slug = 'vendor-no-cut';

UPDATE public.help_articles
SET
  body_md = $md$
On a pending booking you can send a new price (extras or discounts).

> [!NOTE]
> The client must **accept** the new total before they pay. The Eventtz fee is **5% of the full vendor total** after your changes, including surcharges. If they used your referral code, tier savings (£10 at £400+, £15 at £600+) are recalculated on the new total.

### 1. Create the update
Please open the booking and add a clear surcharge or discount with a label.

### 2. Send it
Please send it to the client and wait for them to **accept** or **decline**.

Explain price changes in chat so the client is not surprised. The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply).
$md$,
  related_slugs = ARRAY['vendor-accept-booking','vendor-custom-quote','vendor-no-cut','vendor-client-referrals'],
  updated_at = now()
WHERE slug = 'vendor-price-update';

UPDATE public.help_articles
SET
  body_md = $md$
You pay **after the vendor accepts**. Checkout shows the full total before you confirm payment.

> [!NOTE]
> The total includes the vendor portion, the **5% Eventtz fee** on that vendor total, and any **referral savings** if you used the vendor's code.

### 1. Wait for acceptance
The vendor reviews your request and accepts or declines. The date is not held until you pay.

### 2. Review the breakdown
Open the booking and start checkout. You see:

- Vendor portion (packages and agreed changes)
- Eventtz fee (5% of the vendor total, minus referral savings if applicable)
- **Total due**

### 3. Pay securely
Pay on the secure payment page. We hold the money until the event is done.

If you have not paid about **24 hours** after they accept, we remind you to pay to confirm the date.

> [!WARNING]
> If you wait too long, another client could book the same date with that vendor.

After you pay, open a **Payment receipt** from the booking or **Payment history**.

If payment fails, try again from the same booking or use **Contact** and include the booking ID.
$md$,
  updated_at = now()
WHERE slug = 'client-when-do-i-pay';

UPDATE public.help_articles
SET
  body_md = $md$
Everything stays in one place from first browse to payment. You do not pay until the vendor accepts, and the date is not held until you pay.

> [!NOTE]
> You can message several vendors at once, but only **pay** the booking you want to keep.

### 1. Browse and choose
Open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon.

If a vendor shared a referral link (`?vref=`), open it before you book so your code is saved. You can also enter their code on the booking form.

### 2. Send a request
Pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**.

### 3. Agree the details
Use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept
When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee and any referral savings, before you confirm.

### 5. After the event
Confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
$md$,
  related_slugs = ARRAY['client-when-do-i-pay','client-service-fee','client-multi-enquire','client-event-planner'],
  updated_at = now()
WHERE slug = 'client-how-booking-works';

UPDATE public.help_articles
SET
  body_md = $md$
Download a receipt for a paid booking, or browse everything you have paid from **Payment history**.

## Payment history

Open **Payment history** from your menu. You will see bookings that have been paid, refunded, or paid out.

## Payment receipt

On a paid booking, open **Payment receipt**. You can view it on screen and download or print the page.

The receipt shows the event, vendor portion, Eventtz fee (including any referral discount line), and payment status.

## If a receipt is missing

Receipts appear after payment succeeds. If you paid and still cannot see one, use **Contact** and include the booking ID.
$md$,
  related_slugs = ARRAY['client-payments-hub','client-when-do-i-pay','client-payment-safe','client-service-fee'],
  updated_at = now()
WHERE slug = 'client-payment-receipts';

UPDATE public.help_articles
SET
  body_md = $md$
Use **Browse** to find vendors by service, location, and date. Each listing shows packages, photos, reviews, and prices where the vendor has listed them.

> [!NOTE]
> If a vendor sent you a referral link, open it before you book. The `?vref=` part saves their code so you can get tier savings on the Eventtz fee when the booking qualifies (£10 at £400+, £15 at £600+).

### 1. Search and filter
Use filters for service type, area, and availability. Open a profile to read more.

### 2. Save favourites
Tap the heart to save vendors you like. Find them again under **Favourites**.

### 3. Send a request or message
Pick packages and send a booking request, or message the vendor first if you need a custom quote.
$md$,
  related_slugs = ARRAY['client-favourites','client-how-booking-works','client-service-fee','client-event-planner'],
  updated_at = now()
WHERE slug = 'client-browse-vendors';

UPDATE public.help_articles
SET
  title = 'Joining through a partner signup link',
  summary = 'Register with a partner ?ref= link. This is not the same as a client booking referral.',
  body_md = $md$
Some **partners** share a special **vendor register** link with `?ref=` in the URL. If you open that link, Eventtz records the partner referral when you create your vendor account.

> [!NOTE]
> This is **not** the same as your **client referral link** (`?vref=`) that gives clients savings on the Eventtz fee when they book you. Partner links are for tracking who referred you to Eventtz as a vendor.

### 1. Open the partner link
Please open the link your partner sent.

### 2. Complete vendor register
Finish **vendor register** as usual, then complete **Profile** and submit when ready.

The partner referral does not change how approval or payouts work. It only helps Eventtz and the partner track signups.
$md$,
  related_slugs = ARRAY['vendor-how-to-join','vendor-onboarding-steps','vendor-client-referrals'],
  updated_at = now()
WHERE slug = 'vendor-referral-signup';

UPDATE public.help_articles
SET
  body_md = $md$
Please open **Referrals** in the admin sidebar.

> [!NOTE]
> **Partner signup links** (`?ref=` on vendor register) are separate from **vendor client referral links** (`?vref=` on browse). Partners track who referred a vendor to Eventtz. Client referrals give end clients tier savings on the Eventtz booking fee.

### 1. Create a partner
Please add a partner name (and notes if you use them).

### 2. Share the link
Please copy the **vendor register** link and share it with the partner.

Open a partner to see vendors who registered through that link. Attribution is recorded on first signup from the link. Referrals do not change vendor approval or payout rules. They are for tracking and partner relationships only.
$md$,
  related_slugs = ARRAY['admin-approve-vendors','admin-dashboard-overview','vendor-client-referrals'],
  updated_at = now()
WHERE slug = 'admin-referral-partners';

-- Patch client dashboard related links if article exists
UPDATE public.help_articles
SET
  related_slugs = ARRAY['client-how-booking-works','client-event-planner','client-notifications','client-payments-hub'],
  updated_at = now()
WHERE slug = 'client-dashboard';

UPDATE public.help_articles
SET
  related_slugs = ARRAY['vendor-growth-copilot','vendor-analytics','vendor-client-referrals','vendor-notifications'],
  updated_at = now()
WHERE slug = 'vendor-growth-copilot';
