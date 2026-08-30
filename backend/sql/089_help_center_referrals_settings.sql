-- Help Center: vendor client referrals live under Settings > Referrals (not Dashboard).

UPDATE public.help_articles
SET
  body_md = $md$
Every approved vendor can create a **client referral code** and share link in **Settings > Referrals**. When a client books with your link or code, they can save on the **Eventtz booking fee**. Your quote and payout stay the same.

> [!NOTE]
> This is different from a **partner signup link** (`?ref=` on vendor register). Client referrals use `?vref=` on your listing and lower the client's Eventtz fee only.

## Tier savings (off the Eventtz fee)

| Vendor total on the booking | Client saves |
|-----------------------------|--------------|
| £400+ | £10 |
| £600+ | £15 |

The best qualifying tier applies (not cumulative). If the total drops below a tier before checkout, the discount updates automatically.

## Your referral code

Your code is **1 to 6 digits** (for example `482910`). Choose your own in Settings or tap **Generate** for a random code.

### 1. Open Referrals in Settings
Please open **Settings**, then select the **Referrals** tab.

### 2. Copy your link or code
Copy the share link or the code itself. Send it by email, social, or your website.

### 3. How clients use it
Clients can open your listing with `?vref=your-code` in the link, or enter the code when they send a booking request.

## Tracking

The same tab lists bookings that used your code: event name, date, status, vendor total, and how much the client saved on the Eventtz fee.

## What you keep

Eventtz charges clients a **5% fee** on the full vendor total (packages plus any surcharges or discounts you add). Referral savings come off that fee only. You still receive your agreed vendor amount.
$md$,
  related_slugs = ARRAY['vendor-no-cut','vendor-account-settings','vendor-when-get-paid','vendor-referral-signup'],
  updated_at = now()
WHERE slug = 'vendor-client-referrals';

UPDATE public.help_articles
SET
  summary = 'See new requests, bookings calendar, and what needs attention.',
  body_md = $md$
Open **Dashboard** when you sign in. It is your home for what needs action today.

## What you will see

- **Attention** cards for new booking requests, unread messages, and payout setup if it is not finished.
- **Bookings calendar** and upcoming events.
- **Growth Co-pilot** tips when available.

Please respond to new requests from **Bookings** or the attention cards. Faster replies win more bookings.

If payout setup is not ready, finish it from **Payments** before you accept paid bookings.

To share a client referral link, open **Settings > Referrals**.
$md$,
  related_slugs = ARRAY['vendor-accept-booking','vendor-client-referrals','vendor-growth-copilot','vendor-notifications'],
  updated_at = now()
WHERE slug = 'vendor-dashboard';

UPDATE public.help_articles
SET
  summary = 'Password, sharing, referrals, notifications, and more under Settings.',
  body_md = $md$
Your **Settings** control login, privacy, client referrals, notifications, and account deletion. These are separate from your public **Profile**.

> [!NOTE]
> Use **Profile** to edit your public listing. Use **Settings** for login, privacy, referrals, and closing the account.

## Open Settings

From the vendor area, select **Settings**.

## What you can manage

- **Account.** Email, password, and **Delete account**.
- **Privacy.** Contact sharing and notification preferences.
- **Referrals.** Your client referral code, share link, and bookings that used it.
- **More.** Keyboard shortcuts and legal links.

Keep notification email on so you do not miss new requests, event reminders, or payout messages.
$md$,
  related_slugs = ARRAY['vendor-delete-account','vendor-edit-profile','vendor-client-referrals','vendor-contact-support'],
  updated_at = now()
WHERE slug = 'vendor-account-settings';
